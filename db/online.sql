-- ====================================================================
-- OFFICE ARENA - ONLINE: PHÒNG TRẬN, HÀNG CHỜ GHÉP TRẬN, CHAT LƯU DB, SIẾT RLS
-- Chạy SAU db/setup.sql (SQL Editor của Supabase). Chạy lại nhiều lần vẫn an toàn.
--
--  - matches            : mỗi trận một dòng, server là trọng tài lượt đi + đồng hồ
--  - matchmaking_queue  : chỉ thao tác qua RPC mm_join / mm_leave
--  - chat_messages      : lịch sử chat; DM chỉ 2 người trong cuộc đọc được (RLS)
--  - chat-images        : bucket ảnh chat (thay cho base64 trong broadcast)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. SIẾT RLS CHO CÁC BẢNG CŨ (bỏ các policy "using (true)")
-- --------------------------------------------------------------------
drop policy if exists "Allow upsert on profiles" on public.oa_profiles;
drop policy if exists "Allow insert on match_history" on public.match_history;
drop policy if exists "Allow all on matchmaking_queue" on public.matchmaking_queue;
drop policy if exists "Allow all on transactions" on public.transactions;

drop policy if exists "Own profile insert" on public.oa_profiles;
create policy "Own profile insert" on public.oa_profiles for insert to authenticated
  with check (auth.uid()::text = id);
drop policy if exists "Own profile update" on public.oa_profiles;
create policy "Own profile update" on public.oa_profiles for update to authenticated
  using (auth.uid()::text = id) with check (auth.uid()::text = id);

drop policy if exists "Own match insert" on public.match_history;
create policy "Own match insert" on public.match_history for insert to authenticated
  with check (auth.uid()::text = player_id);

drop policy if exists "Own transactions read" on public.transactions;
create policy "Own transactions read" on public.transactions for select to authenticated
  using (auth.uid()::text = user_id);

-- matchmaking_queue: cố ý KHÔNG có policy → client không đọc/ghi trực tiếp, chỉ qua RPC.

-- Hàm phát Lúa cho toàn bộ người chơi chỉ dành cho cron, không cho client gọi.
revoke execute on function public.distribute_daily_lua_allowance() from public, anon, authenticated;

-- Hàng chờ: mỗi người tối đa 1 dòng.
delete from public.matchmaking_queue a using public.matchmaking_queue b
  where a.user_id = b.user_id and a.created_at < b.created_at;
create unique index if not exists uq_matchmaking_queue_user on public.matchmaking_queue (user_id);

-- --------------------------------------------------------------------
-- 2. PHÒNG TRẬN (MATCHES)
-- p1 luôn đi trước (Trắng / Đỏ). clock1, clock2 là thời gian còn lại (ms)
-- tính tại turn_started_at; đồng hồ chỉ chạy từ nước thứ 3 (ply >= 2).
-- winner: user id, 'draw', hoặc 'none' (ván bị huỷ).
-- --------------------------------------------------------------------
create table if not exists public.matches (
  id text primary key,
  game text not null check (game in ('chess', 'xiangqi')),
  p1 text not null,
  p2 text not null,
  p1_name text,
  p2_name text,
  p1_avatar text,
  p2_avatar text,
  p1_elo integer not null default 1200,
  p2_elo integer not null default 1200,
  stake integer not null default 0 check (stake >= 0),
  base_ms bigint not null default 600000,
  inc_ms bigint not null default 0,
  moves jsonb not null default '[]'::jsonb,
  clock1 bigint not null default 600000,
  clock2 bigint not null default 600000,
  turn_started_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'finished')),
  winner text,
  reason text,
  draw_offer_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (p1 <> p2)
);
create index if not exists idx_matches_p1 on public.matches (p1, created_at desc);
create index if not exists idx_matches_p2 on public.matches (p2, created_at desc);

alter table public.matches enable row level security;
drop policy if exists "Players read match" on public.matches;
create policy "Players read match" on public.matches for select to authenticated
  using (auth.uid()::text in (p1, p2));
-- Không có policy insert/update: mọi thay đổi đi qua các RPC bên dưới.

create or replace function public.match_json(m public.matches, p_ok boolean default true)
returns jsonb language sql stable as $$
  select to_jsonb(m) || jsonb_build_object(
    'ok', p_ok,
    'server_now', floor(extract(epoch from clock_timestamp()) * 1000)::bigint
  );
$$;

-- Thời gian còn lại của bên đang tới lượt, tính theo giờ server.
create or replace function public.match_time_left(m public.matches)
returns bigint language sql stable as $$
  select case
    when jsonb_array_length(m.moves) < 2 then
      case when jsonb_array_length(m.moves) % 2 = 0 then m.clock1 else m.clock2 end
    else
      (case when jsonb_array_length(m.moves) % 2 = 0 then m.clock1 else m.clock2 end)
      - floor(extract(epoch from (now() - m.turn_started_at)) * 1000)::bigint
  end;
$$;

-- Thời gian cộng thêm mỗi nước: Cờ Vua 10+0, Cờ Tướng 10+5 (khớp với client).
create or replace function public.match_inc_ms(p_game text)
returns bigint language sql immutable as $$
  select case when p_game = 'xiangqi' then 5000 else 0 end::bigint;
$$;

-- Đọc trạng thái trận (kèm giờ server để client tính lệch đồng hồ).
create or replace function public.match_state(p_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m public.matches;
begin
  select * into m from public.matches where id = p_id;
  if not found or auth.uid() is null or auth.uid()::text not in (m.p1, m.p2) then
    return null;
  end if;
  return public.match_json(m);
end;
$$;

-- Mở trận cho kèo cược bạn bè: cả hai bên gọi với cùng id, ai gọi trước thì tạo.
create or replace function public.match_open(
  p_id text,
  p_game text,
  p_opp text,
  p_stake integer default 0,
  p_my_name text default null,
  p_my_avatar text default null,
  p_opp_name text default null,
  p_opp_avatar text default null,
  p_base_ms bigint default 600000
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  m public.matches;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_opp is null or p_opp = me then raise exception 'bad_opponent'; end if;
  insert into public.matches (id, game, p1, p2, p1_name, p2_name, p1_avatar, p2_avatar, stake, base_ms, inc_ms, clock1, clock2)
  values (
    p_id, p_game,
    least(me, p_opp), greatest(me, p_opp),
    case when me < p_opp then p_my_name else p_opp_name end,
    case when me < p_opp then p_opp_name else p_my_name end,
    case when me < p_opp then p_my_avatar else p_opp_avatar end,
    case when me < p_opp then p_opp_avatar else p_my_avatar end,
    greatest(0, coalesce(p_stake, 0)), p_base_ms, public.match_inc_ms(p_game), p_base_ms, p_base_ms
  )
  on conflict (id) do nothing;
  return public.match_state(p_id);
end;
$$;

-- Đi một nước. p_ply = số nước đã có trước nước này (chống gửi trùng / lệch).
-- p_result (tuỳ chọn) do client người đi báo khi nước này kết thúc ván:
--   'win' = người đi thắng (chiếu hết), 'loss' = người đi thua (vd. phạm luật lặp), 'draw'.
create or replace function public.match_move(
  p_id text,
  p_ply integer,
  p_move jsonb,
  p_result text default null,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  m public.matches;
  ply integer;
  mover text;
  other text;
  left_ms bigint;
begin
  select * into m from public.matches where id = p_id for update;
  if not found or me is null or me not in (m.p1, m.p2) then raise exception 'match_not_found'; end if;

  ply := jsonb_array_length(m.moves);
  mover := case when ply % 2 = 0 then m.p1 else m.p2 end;
  other := case when mover = m.p1 then m.p2 else m.p1 end;
  if m.status <> 'active' or p_ply <> ply or me <> mover then
    return public.match_json(m, false);
  end if;

  if ply >= 2 then
    left_ms := public.match_time_left(m);
    if left_ms <= 0 then
      update public.matches set
        clock1 = case when mover = p1 then 0 else clock1 end,
        clock2 = case when mover = p2 then 0 else clock2 end,
        status = 'finished', winner = other, reason = 'timeout', draw_offer_by = null, updated_at = now()
      where id = p_id returning * into m;
      return public.match_json(m, false);
    end if;
    if mover = m.p1 then m.clock1 := left_ms + m.inc_ms; else m.clock2 := left_ms + m.inc_ms; end if;
  end if;

  update public.matches set
    moves = moves || jsonb_build_array(p_move),
    clock1 = m.clock1,
    clock2 = m.clock2,
    turn_started_at = now(),
    draw_offer_by = null,
    status = case when p_result in ('win', 'loss', 'draw') then 'finished' else 'active' end,
    winner = case p_result when 'win' then me when 'loss' then other when 'draw' then 'draw' else null end,
    reason = case when p_result in ('win', 'loss', 'draw') then left(p_reason, 80) else null end,
    updated_at = now()
  where id = p_id returning * into m;
  return public.match_json(m);
end;
$$;

-- Hành động ngoài nước đi:
--   resign | draw_offer | draw_accept | draw_decline | flag | abort
--   flag : báo hết giờ — server tự kiểm tra bằng giờ của server.
--          p_flag_draw = true khi bên còn giờ không đủ quân chiếu hết (luật FIDE 6.9).
--   abort: huỷ ván khi chưa ai đi quá 1 nước (vd. đối thủ không vào bàn).
create or replace function public.match_action(p_id text, p_action text, p_flag_draw boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  m public.matches;
  other text;
  ply integer;
  mover text;
begin
  select * into m from public.matches where id = p_id for update;
  if not found or me is null or me not in (m.p1, m.p2) then raise exception 'match_not_found'; end if;
  if m.status <> 'active' then return public.match_json(m, false); end if;

  other := case when me = m.p1 then m.p2 else m.p1 end;
  ply := jsonb_array_length(m.moves);
  mover := case when ply % 2 = 0 then m.p1 else m.p2 end;

  if p_action = 'resign' then
    update public.matches set status = 'finished', winner = other, reason = 'resign', draw_offer_by = null, updated_at = now()
    where id = p_id returning * into m;
  elsif p_action = 'draw_offer' then
    if m.draw_offer_by is null then
      update public.matches set draw_offer_by = me, updated_at = now() where id = p_id returning * into m;
    end if;
  elsif p_action = 'draw_decline' then
    if m.draw_offer_by = other then
      update public.matches set draw_offer_by = null, updated_at = now() where id = p_id returning * into m;
    end if;
  elsif p_action = 'draw_accept' then
    if m.draw_offer_by = other then
      update public.matches set status = 'finished', winner = 'draw', reason = 'agreed', draw_offer_by = null, updated_at = now()
      where id = p_id returning * into m;
    else
      return public.match_json(m, false);
    end if;
  elsif p_action = 'flag' then
    if ply >= 2 and public.match_time_left(m) <= 0 then
      update public.matches set
        clock1 = case when mover = p1 then 0 else clock1 end,
        clock2 = case when mover = p2 then 0 else clock2 end,
        status = 'finished',
        winner = case when p_flag_draw then 'draw' else (case when mover = p1 then p2 else p1 end) end,
        reason = case when p_flag_draw then 'timeout_draw' else 'timeout' end,
        draw_offer_by = null, updated_at = now()
      where id = p_id returning * into m;
    else
      return public.match_json(m, false);
    end if;
  elsif p_action = 'abort' then
    if ply < 2 then
      update public.matches set status = 'finished', winner = 'none', reason = 'abort', draw_offer_by = null, updated_at = now()
      where id = p_id returning * into m;
    else
      return public.match_json(m, false);
    end if;
  else
    raise exception 'bad_action';
  end if;
  return public.match_json(m);
end;
$$;

-- --------------------------------------------------------------------
-- 3. GHÉP TRẬN QUA HÀNG CHỜ
-- Client gọi mm_join mỗi ~2s khi đang tìm (vừa là heartbeat vừa là thăm dò).
-- Dòng chờ quá 15s không heartbeat bị coi là đã rời.
-- --------------------------------------------------------------------
create or replace function public.mm_join(
  p_game text,
  p_stake integer,
  p_elo integer,
  p_name text,
  p_avatar text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  q public.matchmaking_queue;
  opp public.matchmaking_queue;
  m public.matches;
  v_id text;
  me_first boolean;
  waiting integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_game not in ('chess', 'xiangqi') then raise exception 'game_not_online'; end if;
  p_stake := greatest(0, coalesce(p_stake, 0));

  -- Một khoá cho mỗi (game, mức cược): hai người không thể ghép chéo nhau cùng lúc.
  perform pg_advisory_xact_lock(hashtext('mm:' || p_game || ':' || p_stake));

  -- Đã được người khác ghép trong lúc chờ?
  select * into q from public.matchmaking_queue where user_id = me;
  if found and q.status = 'matched' and q.room_code is not null then
    delete from public.matchmaking_queue where user_id = me;
    select * into m from public.matches where id = q.room_code;
    if found and m.status = 'active' then
      return jsonb_build_object('status', 'matched', 'match', public.match_json(m));
    end if;
  end if;

  delete from public.matchmaking_queue where status = 'waiting' and updated_at < now() - interval '15 seconds';
  delete from public.matchmaking_queue where status = 'matched' and updated_at < now() - interval '2 minutes';

  select * into opp from public.matchmaking_queue
  where status = 'waiting' and game_type = p_game and stake = p_stake and user_id <> me
  order by abs(elo - coalesce(p_elo, 1200)), created_at
  limit 1;

  if found then
    v_id := gen_random_uuid()::text;
    me_first := random() < 0.5;
    insert into public.matches (id, game, p1, p2, p1_name, p2_name, p1_avatar, p2_avatar, p1_elo, p2_elo, stake, inc_ms)
    values (
      v_id, p_game,
      case when me_first then me else opp.user_id end,
      case when me_first then opp.user_id else me end,
      case when me_first then p_name else opp.username end,
      case when me_first then opp.username else p_name end,
      case when me_first then p_avatar else opp.avatar end,
      case when me_first then opp.avatar else p_avatar end,
      case when me_first then coalesce(p_elo, 1200) else opp.elo end,
      case when me_first then opp.elo else coalesce(p_elo, 1200) end,
      p_stake,
      public.match_inc_ms(p_game)
    ) returning * into m;
    update public.matchmaking_queue
      set status = 'matched', room_code = v_id, matched_opponent_id = me, updated_at = now()
      where id = opp.id;
    delete from public.matchmaking_queue where user_id = me;
    return jsonb_build_object('status', 'matched', 'match', public.match_json(m));
  end if;

  -- Chưa có ai: vào / giữ chỗ trong hàng chờ (giữ created_at để ai chờ lâu được ghép trước).
  update public.matchmaking_queue
    set updated_at = now(), username = coalesce(p_name, username), avatar = coalesce(p_avatar, avatar), elo = coalesce(p_elo, elo)
    where user_id = me and status = 'waiting' and game_type = p_game and stake = p_stake;
  if not found then
    delete from public.matchmaking_queue where user_id = me;
    insert into public.matchmaking_queue (user_id, username, avatar, game_type, stake, elo)
    values (me, coalesce(p_name, 'Kỳ thủ'), coalesce(p_avatar, ''), p_game, p_stake, coalesce(p_elo, 1200));
  end if;

  select count(*) into waiting from public.matchmaking_queue
    where status = 'waiting' and game_type = p_game and user_id <> me;
  return jsonb_build_object('status', 'waiting', 'others_waiting', waiting);
end;
$$;

-- Rời hàng chờ. Nếu vừa bị ghép mà đã bấm huỷ thì huỷ luôn trận đó để đối thủ không phải chờ.
create or replace function public.mm_leave()
returns void language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  q public.matchmaking_queue;
begin
  if me is null then return; end if;
  select * into q from public.matchmaking_queue where user_id = me;
  if found and q.status = 'matched' and q.room_code is not null then
    update public.matches set status = 'finished', winner = 'none', reason = 'abort', updated_at = now()
      where id = q.room_code and status = 'active' and jsonb_array_length(moves) = 0;
  end if;
  delete from public.matchmaking_queue where user_id = me;
end;
$$;

-- --------------------------------------------------------------------
-- 4. CHAT LƯU DB
-- payload = nguyên ChatMessage của client; sender_id = người thực sự gửi (auth.uid()).
-- --------------------------------------------------------------------
create table if not exists public.chat_messages (
  id text primary key,
  channel_id text not null,
  sender_id text not null default auth.uid()::text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_messages_channel on public.chat_messages (channel_id, created_at desc);
create index if not exists idx_chat_messages_bet on public.chat_messages ((payload -> 'betChallenge' ->> 'id'))
  where payload ? 'betChallenge';

-- Kênh DM có dạng dm-<idA>__<idB>: chỉ hai người đó đọc/ghi. Kênh khác: mọi tài khoản.
create or replace function public.chat_can_access(p_channel text)
returns boolean language sql stable as $$
  select case
    when p_channel like 'dm-%' then auth.uid()::text = any (string_to_array(substr(p_channel, 4), '__'))
    else auth.uid() is not null
  end;
$$;

alter table public.chat_messages enable row level security;
drop policy if exists "Chat read" on public.chat_messages;
create policy "Chat read" on public.chat_messages for select to authenticated
  using (public.chat_can_access(channel_id));
drop policy if exists "Chat insert own" on public.chat_messages;
create policy "Chat insert own" on public.chat_messages for insert to authenticated
  with check (
    sender_id = auth.uid()::text
    and public.chat_can_access(channel_id)
    and octet_length(payload::text) <= 20000
  );
-- Không cho sửa/xoá trực tiếp; trạng thái kèo cược đổi qua chat_update_bet.

-- Đổi trạng thái kèo cược trong tin nhắn, chỉ theo các bước hợp lệ:
--   pending  → accepted  (người nhận kèo, ai nhận trước thì được)
--   pending  → cancelled (người tạo kèo)
--   accepted → in_game / completed (một trong hai người chơi)
-- Trả về kèo đang lưu sau khi xử lý (client so sánh để biết mình có "thắng chỗ" hay không).
create or replace function public.chat_update_bet(p_bet jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r public.chat_messages;
  cur jsonb;
  nxt jsonb;
  want text := p_bet ->> 'status';
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into r from public.chat_messages
    where payload ? 'betChallenge' and payload -> 'betChallenge' ->> 'id' = p_bet ->> 'id'
    for update;
  if not found then return null; end if;
  cur := r.payload -> 'betChallenge';

  if cur ->> 'status' = 'pending' and want = 'accepted'
     and me <> cur ->> 'creatorId'
     and (cur ->> 'targetId' is null or cur ->> 'targetId' = me) then
    nxt := cur || jsonb_build_object(
      'status', 'accepted', 'opponentId', me,
      'opponentName', p_bet ->> 'opponentName', 'opponentAvatar', p_bet ->> 'opponentAvatar');
  elsif cur ->> 'status' = 'pending' and want = 'cancelled' and me = cur ->> 'creatorId' then
    nxt := cur || jsonb_build_object('status', 'cancelled');
  elsif cur ->> 'status' in ('accepted', 'in_game') and want in ('in_game', 'completed')
     and me in (cur ->> 'creatorId', cur ->> 'opponentId') then
    nxt := cur || jsonb_build_object('status', want);
    if p_bet ? 'winnerId' then nxt := nxt || jsonb_build_object('winnerId', p_bet -> 'winnerId'); end if;
  else
    return cur;
  end if;

  update public.chat_messages set payload = jsonb_set(payload, '{betChallenge}', nxt) where id = r.id;
  return nxt;
end;
$$;

-- --------------------------------------------------------------------
-- 5. REALTIME (postgres_changes) CHO matches + chat_messages
-- --------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'matches') then
      alter publication supabase_realtime add table public.matches;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages') then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
  end if;
end $$;

-- --------------------------------------------------------------------
-- 6. QUYỀN GỌI HÀM
-- --------------------------------------------------------------------
revoke execute on function public.match_state(text) from public, anon;
revoke execute on function public.match_open(text, text, text, integer, text, text, text, text, bigint) from public, anon;
revoke execute on function public.match_move(text, integer, jsonb, text, text) from public, anon;
revoke execute on function public.match_action(text, text, boolean) from public, anon;
revoke execute on function public.mm_join(text, integer, integer, text, text) from public, anon;
revoke execute on function public.mm_leave() from public, anon;
revoke execute on function public.chat_update_bet(jsonb) from public, anon;
grant execute on function public.match_state(text) to authenticated;
grant execute on function public.match_open(text, text, text, integer, text, text, text, text, bigint) to authenticated;
grant execute on function public.match_move(text, integer, jsonb, text, text) to authenticated;
grant execute on function public.match_action(text, text, boolean) to authenticated;
grant execute on function public.mm_join(text, integer, integer, text, text) to authenticated;
grant execute on function public.mm_leave() to authenticated;
grant execute on function public.chat_update_bet(jsonb) to authenticated;

-- --------------------------------------------------------------------
-- 7. STORAGE: ẢNH / TỆP ĐÍNH KÈM TRONG CHAT (mỗi người chỉ ghi vào thư mục của mình)
-- --------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', true, 2097152, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain', 'text/csv', 'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Chat images public read" on storage.objects;
create policy "Chat images public read" on storage.objects for select using (bucket_id = 'chat-images');
drop policy if exists "Chat images own upload" on storage.objects;
create policy "Chat images own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
