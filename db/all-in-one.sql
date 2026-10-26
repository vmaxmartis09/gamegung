
-- ====================================================================
-- >>> setup.sql
-- ====================================================================

-- ====================================================================
-- OFFICE ARENA - SUPABASE DATABASE SCHEMA
-- HỆ THỐNG TÍNH ĐIỂM ELO, RANKING, ĐẶT CƯỢC LÚA & GHÉP TRẬN MATCHMAKING
-- Chạy file này rồi chạy tiếp db/online.sql (phòng trận, hàng chờ, chat). Cả hai chạy lại được.
-- ====================================================================

-- 1. BẢNG HỒ SƠ NGƯỜI CHƠI (PROFILES)
create table if not exists public.oa_profiles (
  id text primary key,
  username text,
  full_name text,
  avatar text,
  avatar_url text,
  title text default 'Kỳ Thủ Văn Phòng',
  lua bigint not null default 1000 check (lua >= 0),
  elo_chess integer not null default 1200 check (elo_chess >= 100),
  elo_xiangqi integer not null default 1200 check (elo_xiangqi >= 100),
  elo_werewolf integer not null default 1000 check (elo_werewolf >= 100),
  badges jsonb not null default '[]'::jsonb,
  equipped_badges jsonb not null default '[]'::jsonb,
  character jsonb not null default '{}'::jsonb,
  inventory jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{
    "chess": {"wins": 0, "losses": 0, "draws": 0, "games": 0},
    "xiangqi": {"wins": 0, "losses": 0, "draws": 0, "games": 0},
    "werewolf": {"wins": 0, "losses": 0, "draws": 0, "games": 0}
  }'::jsonb,
  last_daily_claim timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hỗ trợ nâng cấp thêm cột nếu bảng profiles đã tồn tại từ trước:
alter table public.oa_profiles add column if not exists character jsonb default '{}'::jsonb;
alter table public.oa_profiles add column if not exists inventory jsonb default '[]'::jsonb;
alter table public.oa_profiles add column if not exists lua bigint default 1000;
alter table public.oa_profiles add column if not exists elo_chess integer default 1200;
alter table public.oa_profiles add column if not exists elo_xiangqi integer default 1200;
alter table public.oa_profiles add column if not exists elo_werewolf integer default 1000;
alter table public.oa_profiles add column if not exists badges jsonb default '[]'::jsonb;
alter table public.oa_profiles add column if not exists equipped_badges jsonb default '[]'::jsonb;
alter table public.oa_profiles add column if not exists stats jsonb default '{"chess": {"wins": 0, "losses": 0, "draws": 0, "games": 0}, "xiangqi": {"wins": 0, "losses": 0, "draws": 0, "games": 0}, "werewolf": {"wins": 0, "losses": 0, "draws": 0, "games": 0}}'::jsonb;

-- 2. BẢNG LỊCH SỬ ĐẤU & ĐẶT CƯỢC (MATCH_HISTORY)
create table if not exists public.match_history (
  id uuid primary key default gen_random_uuid(),
  game_type text not null check (game_type in ('chess', 'xiangqi', 'werewolf', 'uno', 'arcade', 'typing')),
  player_id text not null,
  player_name text not null,
  opponent_id text,
  opponent_name text default 'AI Bot',
  opponent_elo integer default 1200,
  result text not null check (result in ('win', 'loss', 'draw')),
  stake integer not null default 0 check (stake >= 0),
  lua_change integer not null default 0,
  elo_change integer not null default 0,
  new_elo integer not null default 1200,
  created_at timestamptz not null default now()
);

-- 3. BẢNG HÀNG CHỜ GHÉP TRẬN (MATCHMAKING_QUEUE)
create table if not exists public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  username text not null,
  avatar text not null,
  game_type text not null check (game_type in ('chess', 'xiangqi', 'werewolf', 'uno', 'arcade', 'typing')),
  stake integer not null default 0 check (stake >= 0),
  elo integer not null default 1200,
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled')),
  room_code text,
  matched_opponent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. BẢNG GIAO DỊCH LÚA (TRANSACTIONS)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  amount integer not null,
  type text not null,
  description text not null,
  balance_after bigint not null,
  created_at timestamptz not null default now()
);

-- ====================================================================
-- INDEXES CHO TỐI ƯU HIỆU NĂNG QUERY & BẢNG XẾP HẠNG (LEADERBOARD)
-- ====================================================================
create index if not exists idx_oa_profiles_elo_chess on public.oa_profiles (elo_chess desc);
create index if not exists idx_oa_profiles_elo_xiangqi on public.oa_profiles (elo_xiangqi desc);
create index if not exists idx_oa_profiles_elo_werewolf on public.oa_profiles (elo_werewolf desc);
create index if not exists idx_oa_profiles_lua on public.oa_profiles (lua desc);
create index if not exists idx_match_history_player on public.match_history (player_id, created_at desc);
create index if not exists idx_matchmaking_queue_lookup on public.matchmaking_queue (game_type, stake, status, created_at);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
alter table public.oa_profiles enable row level security;
alter table public.match_history enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.transactions enable row level security;

-- Cho phép đọc công khai hồ sơ và bảng xếp hạng
drop policy if exists "Allow public read on profiles" on public.oa_profiles;
create policy "Allow public read on profiles" on public.oa_profiles
  for select using (true);

-- Chỉ được ghi hồ sơ của chính mình
drop policy if exists "Allow upsert on profiles" on public.oa_profiles;
drop policy if exists "Own profile insert" on public.oa_profiles;
create policy "Own profile insert" on public.oa_profiles for insert to authenticated
  with check (auth.uid()::text = id);
drop policy if exists "Own profile update" on public.oa_profiles;
create policy "Own profile update" on public.oa_profiles for update to authenticated
  using (auth.uid()::text = id) with check (auth.uid()::text = id);

-- Lịch sử đấu: ai cũng đọc được, chỉ ghi trận của chính mình
drop policy if exists "Allow public read on match_history" on public.match_history;
create policy "Allow public read on match_history" on public.match_history
  for select using (true);
drop policy if exists "Allow insert on match_history" on public.match_history;
drop policy if exists "Own match insert" on public.match_history;
create policy "Own match insert" on public.match_history for insert to authenticated
  with check (auth.uid()::text = player_id);

-- Hàng chờ ghép trận: không có policy, chỉ thao tác qua RPC mm_join / mm_leave (db/online.sql)
drop policy if exists "Allow all on matchmaking_queue" on public.matchmaking_queue;

-- Giao dịch Lúa: chỉ đọc của mình; ghi qua hàm security definer
drop policy if exists "Allow all on transactions" on public.transactions;
drop policy if exists "Own transactions read" on public.transactions;
create policy "Own transactions read" on public.transactions for select to authenticated
  using (auth.uid()::text = user_id);

-- ====================================================================
-- TỰ ĐỘNG CẬP NHẬT UPDATED_AT
-- ====================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger trg_profiles_updated_at
before update on public.oa_profiles
for each row execute function public.handle_updated_at();

create or replace trigger trg_matchmaking_updated_at
before update on public.matchmaking_queue
for each row execute function public.handle_updated_at();

-- ====================================================================
-- HỆ THỐNG TRIGGER & HÀM CỘNG LÚA HÀNG NGÀY THEO BẬC ELO (DAILY BONUS)
-- MỨC CƠ BẢN: +500 LÚA 🌾 | ELO CÀNG CAO THƯỞNG CÀNG LỚN (ĐẾN 1,500 🌾)
-- ====================================================================

-- 1. Hàm tính toán số Lúa được nhận mỗi ngày dựa trên ELO cao nhất
create or replace function public.calculate_daily_lua(p_elo integer)
returns integer as $$
begin
  if p_elo >= 2000 then
    return 1500; -- 500 gốc + 1000 thưởng Đại Kiện Tướng (Master)
  elsif p_elo >= 1800 then
    return 1100; -- 500 gốc + 600 thưởng Kiện Tướng (Diamond)
  elsif p_elo >= 1600 then
    return 900;  -- 500 gốc + 400 thưởng Tinh Anh (Platinum)
  elsif p_elo >= 1400 then
    return 750;  -- 500 gốc + 250 thưởng Cao Thủ (Gold)
  elsif p_elo >= 1200 then
    return 600;  -- 500 gốc + 100 thưởng Chiến Binh (Silver)
  else
    return 500;  -- 500 gốc Tập Sự (Bronze)
  end if;
end;
$$ language plpgsql immutable;

-- 2. Hàm lấy tên danh hiệu ELO cho nhật ký giao dịch
create or replace function public.get_elo_tier_name(p_elo integer)
returns text as $$
begin
  if p_elo >= 2000 then return 'Đại Kiện Tướng (Master)';
  elsif p_elo >= 1800 then return 'Kiện Tướng (Diamond)';
  elsif p_elo >= 1600 then return 'Tinh Anh (Platinum)';
  elsif p_elo >= 1400 then return 'Cao Thủ (Gold)';
  elsif p_elo >= 1200 then return 'Chiến Binh (Silver)';
  else return 'Tập Sự (Bronze)';
  end if;
end;
$$ language plpgsql immutable;

-- 3. Stored Procedure RPC: Điểm danh nhận Lúa có kiểm tra 24h & ELO
create or replace function public.claim_daily_lua(p_user_id text)
returns jsonb as $$
declare
  v_profile record;
  v_max_elo integer;
  v_allowance integer;
  v_tier_name text;
  v_new_lua bigint;
  v_hours_left integer;
begin
  -- Chỉ được tự điểm danh cho chính mình
  if auth.uid() is null or auth.uid()::text <> p_user_id then
    return jsonb_build_object('success', false, 'message', 'Không có quyền điểm danh cho tài khoản này.');
  end if;

  -- Khóa dòng người dùng để tránh race-condition (double-claim)
  select * into v_profile
  from public.oa_profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Không tìm thấy hồ sơ người chơi.'
    );
  end if;

  -- Kiểm tra thời gian 24 giờ kể từ lần nhận gần nhất
  if v_profile.last_daily_claim is not null and (now() - v_profile.last_daily_claim) < interval '24 hours' then
    v_hours_left := ceil(extract(epoch from (v_profile.last_daily_claim + interval '24 hours' - now())) / 3600);
    return jsonb_build_object(
      'success', false,
      'hours_left', v_hours_left,
      'message', 'Bạn đã nhận Lúa hôm nay rồi. Vui lòng quay lại sau ' || v_hours_left || ' giờ nữa!'
    );
  end if;

  -- Lấy điểm ELO cao nhất trong 3 game (Cờ Vua, Cờ Tướng, Ma Sói)
  v_max_elo := greatest(
    coalesce(v_profile.elo_chess, 1200),
    coalesce(v_profile.elo_xiangqi, 1200),
    coalesce(v_profile.elo_werewolf, 1000)
  );

  v_allowance := public.calculate_daily_lua(v_max_elo);
  v_tier_name := public.get_elo_tier_name(v_max_elo);
  v_new_lua := v_profile.lua + v_allowance;

  -- Cập nhật số dư Lúa và thời điểm nhận
  update public.oa_profiles
  set
    lua = v_new_lua,
    last_daily_claim = now(),
    updated_at = now()
  where id = p_user_id;

  -- Ghi nhận lịch sử giao dịch vào bảng transactions
  insert into public.transactions (
    user_id,
    amount,
    type,
    description,
    balance_after
  ) values (
    p_user_id,
    v_allowance,
    'daily_bonus',
    'Điểm danh hàng ngày: Cơ bản 500 🌾 + Thưởng rank ' || v_tier_name || ' (+' || v_allowance || ' 🌾)',
    v_new_lua
  );

  return jsonb_build_object(
    'success', true,
    'amount', v_allowance,
    'new_balance', v_new_lua,
    'tier_name', v_tier_name,
    'max_elo', v_max_elo,
    'message', 'Điểm danh thành công! Bạn nhận được +' || v_allowance || ' Lúa 🌾 (Thưởng rank ' || v_tier_name || ')!'
  );
end;
$$ language plpgsql security definer;

-- 4. Trigger tự động cộng Lúa khi người chơi đăng nhập / đồng bộ profile qua 24h
create or replace function public.trg_fn_auto_claim_daily_on_sync()
returns trigger as $$
declare
  v_max_elo integer;
  v_allowance integer;
  v_tier_name text;
begin
  -- Nếu chưa từng nhận hoặc đã qua 24h kể từ lần nhận trước
  if (old.last_daily_claim is null or (now() - old.last_daily_claim) >= interval '24 hours')
     and (new.last_daily_claim is distinct from old.last_daily_claim or new.updated_at > old.updated_at + interval '1 hour') then
    
    v_max_elo := greatest(
      coalesce(new.elo_chess, 1200),
      coalesce(new.elo_xiangqi, 1200),
      coalesce(new.elo_werewolf, 1000)
    );

    v_allowance := public.calculate_daily_lua(v_max_elo);
    v_tier_name := public.get_elo_tier_name(v_max_elo);

    new.lua := new.lua + v_allowance;
    new.last_daily_claim := now();

    insert into public.transactions (
      user_id,
      amount,
      type,
      description,
      balance_after
    ) values (
      new.id,
      v_allowance,
      'daily_bonus',
      'Tự động kích hoạt điểm danh: Cơ bản 500 🌾 + Thưởng ' || v_tier_name || ' (+' || v_allowance || ' 🌾)',
      new.lua
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger trg_profiles_auto_daily_claim
before update on public.oa_profiles
for each row execute function public.trg_fn_auto_claim_daily_on_sync();

-- 5. Hàm chạy định kỳ tự động phát Lúa mỗi ngày cho toàn bộ người chơi (Scheduled Cron)
create or replace function public.distribute_daily_lua_allowance()
returns table (affected_count integer, total_lua_granted bigint) as $$
declare
  r record;
  v_max_elo integer;
  v_allowance integer;
  v_tier_name text;
  v_new_lua bigint;
  v_count integer := 0;
  v_total bigint := 0;
begin
  for r in
    select id, lua, elo_chess, elo_xiangqi, elo_werewolf
    from public.oa_profiles
    where last_daily_claim is null or (now() - last_daily_claim) >= interval '24 hours'
    for update
  loop
    v_max_elo := greatest(
      coalesce(r.elo_chess, 1200),
      coalesce(r.elo_xiangqi, 1200),
      coalesce(r.elo_werewolf, 1000)
    );
    v_allowance := public.calculate_daily_lua(v_max_elo);
    v_tier_name := public.get_elo_tier_name(v_max_elo);
    v_new_lua := r.lua + v_allowance;

    update public.oa_profiles
    set
      lua = v_new_lua,
      last_daily_claim = now(),
      updated_at = now()
    where id = r.id;

    insert into public.transactions (
      user_id,
      amount,
      type,
      description,
      balance_after
    ) values (
      r.id,
      v_allowance,
      'daily_bonus',
      'Phát Lúa hàng ngày tự động: Cơ bản 500 🌾 + Thưởng ' || v_tier_name,
      v_new_lua
    );

    v_count := v_count + 1;
    v_total := v_total + v_allowance;
  end loop;

  return query select v_count, v_total;
end;
$$ language plpgsql security definer;

-- Lệnh cấu hình pg_cron trong Supabase (Chạy tự động mỗi ngày lúc 00:00 UTC / 07:00 VN):
-- select cron.schedule('daily-lua-airdrop', '0 0 * * *', 'select public.distribute_daily_lua_allowance();');

-- ====================================================================
-- MIGRATION 2026-10: CỘT ELO CÒN THIẾU (app đồng bộ các cột này)
-- ====================================================================
alter table public.oa_profiles add column if not exists elo_arcade integer default 1200;
alter table public.oa_profiles add column if not exists elo_uno integer default 1200;


-- Nếu bảng đã tồn tại với check cũ, nới rộng game_type:
alter table public.match_history drop constraint if exists match_history_game_type_check;
alter table public.match_history add constraint match_history_game_type_check
  check (game_type in ('chess', 'xiangqi', 'werewolf', 'uno', 'arcade', 'typing'));
alter table public.matchmaking_queue drop constraint if exists matchmaking_queue_game_type_check;
alter table public.matchmaking_queue add constraint matchmaking_queue_game_type_check
  check (game_type in ('chess', 'xiangqi', 'werewolf', 'uno', 'arcade', 'typing'));

-- Làm mới schema cache của PostgREST để API thấy bảng/hàm mới ngay
notify pgrst, 'reload schema';

-- ====================================================================
-- STORAGE: BUCKET ẢNH ĐẠI DIỆN "avatars" (public đọc, mỗi người chỉ ghi vào thư mục của mình)
-- ====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "Avatars public read" on storage.objects;
create policy "Avatars public read" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Avatars own upload" on storage.objects;
create policy "Avatars own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatars own update" on storage.objects;
create policy "Avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- ====================================================================
-- >>> online.sql
-- ====================================================================

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


-- ====================================================================
-- >>> caro.sql
-- ====================================================================

-- Cờ Caro online (kèo cược bạn bè): cho phép game 'caro' trong bảng matches / lịch sử / hàng chờ.
-- Caro không có đồng hồ: client mở trận với base_ms rất lớn nên không bao giờ hết giờ.
alter table public.matches drop constraint if exists matches_game_check;
alter table public.matches add constraint matches_game_check check (game in ('chess', 'xiangqi', 'caro'));
alter table public.match_history drop constraint if exists match_history_game_type_check;
alter table public.match_history add constraint match_history_game_type_check
  check (game_type in ('chess', 'xiangqi', 'werewolf', 'uno', 'arcade', 'typing', 'caro'));
alter table public.matchmaking_queue drop constraint if exists matchmaking_queue_game_type_check;
alter table public.matchmaking_queue add constraint matchmaking_queue_game_type_check
  check (game_type in ('chess', 'xiangqi', 'werewolf', 'uno', 'arcade', 'typing', 'caro'));


-- ====================================================================
-- >>> werewolf-online.sql
-- ====================================================================

-- ====================================================================
-- OFFICE ARENA - MA SÓI ONLINE (server giữ trạng thái ván + vai bí mật)
-- Chạy SAU db/setup.sql và db/online.sql (SQL Editor của Supabase).
-- Chạy lại nhiều lần vẫn an toàn.
--
--  - ww_rooms  : mỗi phòng một dòng: pha, bước đêm, hạn giờ (giờ server) và
--                toàn bộ trạng thái bí mật của đêm (mục tiêu, bình thuốc, phiếu…)
--  - ww_seats  : ghế trong phòng (người thật hoặc bot) + vai bí mật
--  - ww_log    : nhật ký làng / chat; visible_to = các ghế được đọc (null = mọi người)
--  - ww_pulse  : một dòng mỗi phòng, chỉ chứa số phiên bản để client nghe realtime
--
-- Ba bảng đầu bật RLS và KHÔNG có policy: client không đọc thẳng được
-- (vai người khác không bao giờ rời server). Mọi thứ đi qua RPC:
--   ww_create / ww_join / ww_leave / ww_add_bot / ww_kick / ww_set_roles / ww_start / ww_rematch
--   ww_state (đọc phần mình được thấy, đồng thời đẩy ván theo giờ server)
--   ww_act   (bảo vệ, cắn, soi, phù thủy, Cupid, thợ săn, bỏ phiếu, sẵn sàng)
--   ww_chat, ww_resume, ww_list_open
--
-- Thời gian: mỗi pha/bước có `deadline` (giờ server). Bất kỳ lời gọi RPC nào
-- (client thăm dò mỗi ~2s) đều chạy ww__advance: hết hạn thì server tự áp
-- hành động mặc định (bỏ qua / phiếu trắng) và chuyển pha. Tuỳ chọn: bật
-- pg_cron ở cuối file để phòng vẫn chạy khi không ai mở tab.
--
-- Bot chạy hoàn toàn phía server (ghế is_bot): chọn mục tiêu, bỏ phiếu, chat.
-- Chế độ online không cược Lúa.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. BẢNG
-- --------------------------------------------------------------------
create table if not exists public.ww_rooms (
  id text primary key,
  host text not null,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'over', 'closed')),
  roles jsonb not null,
  game_no integer not null default 0,
  phase text not null default 'lobby'
    check (phase in ('lobby', 'reveal', 'night', 'dawn', 'discussion', 'vote', 'verdict', 'hunter', 'over')),
  step text not null default '',
  day integer not null default 0,
  deadline timestamptz,
  step_started_at timestamptz not null default now(),
  winner text,
  -- trạng thái bí mật của ván
  acted integer[] not null default '{}',
  guard_target integer,
  last_guarded integer,
  wolf_votes jsonb not null default '{}'::jsonb,
  wolf_target integer,
  wolf_bonus integer not null default 0,
  white_target integer,
  seer_results jsonb not null default '{}'::jsonb,
  healed boolean not null default false,
  heal_decided boolean not null default false,
  heal_used boolean not null default false,
  poison_target integer,
  poison_used boolean not null default false,
  lovers integer[],
  cupid_done boolean not null default false,
  elder_lives jsonb not null default '{}'::jsonb,
  pending_hunter integer,
  after_hunter text,
  votes jsonb not null default '{}'::jsonb,
  verdict jsonb,
  next_bot_chat timestamptz,
  seq bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ww_rooms_status on public.ww_rooms (status, updated_at desc);

create table if not exists public.ww_seats (
  room_id text not null references public.ww_rooms (id) on delete cascade,
  seat integer not null,
  user_id text,
  name text not null,
  avatar text not null default '',
  is_bot boolean not null default false,
  role text,
  alive boolean not null default true,
  died_day integer,
  cause text,
  ready boolean not null default false,
  last_seen timestamptz not null default now(),
  last_chat_at timestamptz,
  primary key (room_id, seat)
);
create unique index if not exists uq_ww_seats_room_user on public.ww_seats (room_id, user_id) where user_id is not null;
create index if not exists idx_ww_seats_user on public.ww_seats (user_id);

create table if not exists public.ww_log (
  id bigserial primary key,
  room_id text not null references public.ww_rooms (id) on delete cascade,
  day integer not null default 0,
  kind text not null check (kind in ('narrator', 'chat', 'death', 'vote', 'private', 'wolf')),
  speaker integer,
  text text not null,
  visible_to integer[],
  created_at timestamptz not null default now()
);
create index if not exists idx_ww_log_room on public.ww_log (room_id, id);

create table if not exists public.ww_pulse (
  room_id text primary key references public.ww_rooms (id) on delete cascade,
  seq bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ww_rooms enable row level security;
alter table public.ww_seats enable row level security;
alter table public.ww_log enable row level security;
alter table public.ww_pulse enable row level security;
-- ww_rooms / ww_seats / ww_log: cố ý KHÔNG có policy nào.

-- Thành viên phòng (dùng cho policy của ww_pulse, nên phải cho authenticated gọi).
create or replace function public.ww_is_member(p_room text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ww_seats where room_id = p_room and user_id = auth.uid()::text);
$$;

drop policy if exists "Members read pulse" on public.ww_pulse;
create policy "Members read pulse" on public.ww_pulse for select to authenticated
  using (public.ww_is_member(room_id));

-- --------------------------------------------------------------------
-- 2. HÀM NỘI BỘ (tiền tố ww__, không cấp quyền cho client)
-- --------------------------------------------------------------------
create or replace function public.ww__is_wolf(p_role text)
returns boolean language sql immutable as $$
  select coalesce(p_role in ('wolf', 'white_wolf', 'wolf_cub'), false);
$$;

create or replace function public.ww__role_label(p_role text)
returns text language sql immutable as $$
  select case p_role
    when 'wolf' then '🐺 Ma Sói'
    when 'white_wolf' then '🐺⚪ Sói Trắng'
    when 'wolf_cub' then '🐺🐾 Sói Con'
    when 'seer' then '🔮 Tiên Tri'
    when 'guard' then '🛡️ Bảo Vệ'
    when 'witch' then '🧪 Phù Thủy'
    when 'hunter' then '🏹 Thợ Săn'
    when 'cupid' then '💘 Thần Tình Yêu'
    when 'elder' then '👴 Già Làng'
    else '🧑‍💼 Dân Làng'
  end;
$$;

-- Ghế hành động ở mỗi bước đêm.
create or replace function public.ww__acts_in(p_role text, p_step text)
returns boolean language sql immutable as $$
  select case p_step
    when 'wolves' then public.ww__is_wolf(p_role)
    when 'white_wolf' then p_role = 'white_wolf'
    when 'cupid' then p_role = 'cupid'
    when 'guard' then p_role = 'guard'
    when 'seer' then p_role = 'seer'
    when 'witch' then p_role = 'witch'
    else false
  end;
$$;

create or replace function public.ww__validate_roles(p_roles jsonb)
returns text language plpgsql immutable as $$
declare
  n integer;
  w integer;
begin
  if p_roles is null or jsonb_typeof(p_roles) <> 'array' then return 'bad_roles'; end if;
  n := jsonb_array_length(p_roles);
  if n < 6 or n > 16 then return 'bad_player_count'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_roles) e
    where jsonb_typeof(e) <> 'string'
       or e #>> '{}' not in ('wolf', 'white_wolf', 'wolf_cub', 'seer', 'guard', 'witch', 'hunter', 'cupid', 'elder', 'villager')
  ) then return 'bad_roles'; end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_roles) r group by r
    having count(*) > case r when 'wolf' then 5 when 'wolf_cub' then 2 when 'villager' then 9 else 1 end
  ) then return 'bad_roles'; end if;
  select count(*) into w from jsonb_array_elements_text(p_roles) r where public.ww__is_wolf(r);
  if w < 1 or w * 2 >= n then return 'bad_wolf_count'; end if;
  return null;
end;
$$;

create or replace function public.ww__say(p_room text, p_kind text, p_text text, p_speaker integer default null, p_visible integer[] default null)
returns void language sql as $$
  insert into public.ww_log (room_id, day, kind, speaker, text, visible_to)
  select p_room, r.day, p_kind, p_speaker, p_text, p_visible from public.ww_rooms r where r.id = p_room;
$$;

create or replace function public.ww__name(p_room text, p_seat integer)
returns text language sql stable as $$
  select name from public.ww_seats where room_id = p_room and seat = p_seat;
$$;

create or replace function public.ww__wolf_seats(p_room text)
returns integer[] language sql stable as $$
  select coalesce(array_agg(seat order by seat), '{}') from public.ww_seats where room_id = p_room and public.ww__is_wolf(role);
$$;

-- Một ghế còn sống ngẫu nhiên. p_wolves: null = ai cũng được, true = chỉ Sói, false = chỉ phe khác.
create or replace function public.ww__rand_seat(p_room text, p_exclude integer[] default '{}', p_wolves boolean default null)
returns integer language sql volatile as $$
  select seat from public.ww_seats
  where room_id = p_room and alive and not (seat = any (coalesce(p_exclude, '{}')))
    and (p_wolves is null or public.ww__is_wolf(role) = p_wolves)
  order by random() limit 1;
$$;

create or replace function public.ww__humans_alive(p_room text)
returns boolean language sql stable as $$
  select exists (select 1 from public.ww_seats where room_id = p_room and alive and not is_bot);
$$;

-- Tăng phiên bản phòng + gõ ww_pulse để client nghe realtime biết mà tải lại.
create or replace function public.ww__bump(p_room text)
returns void language sql as $$
  update public.ww_rooms set seq = seq + 1, updated_at = now() where id = p_room;
  insert into public.ww_pulse (room_id, seq, updated_at)
  select id, seq, now() from public.ww_rooms where id = p_room
  on conflict (room_id) do update set seq = excluded.seq, updated_at = excluded.updated_at;
$$;

create or replace function public.ww__check_winner(p_room text)
returns text language plpgsql stable as $$
declare
  r public.ww_rooms;
  n_alive integer;
  n_wolves integer;
begin
  select * into r from public.ww_rooms where id = p_room;
  select count(*), count(*) filter (where public.ww__is_wolf(role))
    into n_alive, n_wolves from public.ww_seats where room_id = p_room and alive;
  if r.lovers is not null and n_alive = 2
     and not exists (select 1 from public.ww_seats where room_id = p_room and alive and not (seat = any (r.lovers))) then
    return 'lovers';
  end if;
  if n_wolves = 0 then return 'village'; end if;
  if n_wolves >= n_alive - n_wolves then return 'wolves'; end if;
  return null;
end;
$$;

create or replace function public.ww__notify_lovers(p_room text)
returns void language plpgsql as $$
declare
  r public.ww_rooms;
  cupid integer;
begin
  select * into r from public.ww_rooms where id = p_room;
  if r.lovers is null then return; end if;
  select seat into cupid from public.ww_seats where room_id = p_room and role = 'cupid' limit 1;
  perform public.ww__say(p_room, 'private',
    format('💘 Thần Tình Yêu đã se duyên cho %s và %s. Một người chết, người kia chết theo.',
      public.ww__name(p_room, r.lovers[1]), public.ww__name(p_room, r.lovers[2])),
    null, array_remove(r.lovers || cupid, null));
end;
$$;

-- Một ghế chết. Lo luôn Sói Con (đêm sau cắn 2), Thợ Săn (được bắn) và người yêu (chết theo).
create or replace function public.ww__kill(p_room text, p_seat integer, p_cause text, p_msg text default null)
returns void language plpgsql as $$
declare
  r public.ww_rooms;
  s public.ww_seats;
  partner integer;
begin
  select * into r from public.ww_rooms where id = p_room;
  update public.ww_seats set alive = false, cause = p_cause, died_day = r.day
    where room_id = p_room and seat = p_seat and alive
    returning * into s;
  if not found then return; end if;

  perform public.ww__say(p_room, 'death', coalesce(p_msg,
    case p_cause
      when 'poison' then format('☠️ %s đã chết (trúng độc). Vai: %s.', s.name, public.ww__role_label(s.role))
      when 'vote' then format('🪢 %s bị trục xuất. Vai thật: %s.', s.name, public.ww__role_label(s.role))
      else format('☠️ %s đã chết. Vai: %s.', s.name, public.ww__role_label(s.role))
    end));

  if s.role = 'wolf_cub' then
    update public.ww_rooms set wolf_bonus = 1 where id = p_room;
    perform public.ww__say(p_room, 'narrator', '🐾 Sói Con đã chết! Đêm tới bầy Sói nổi cơn thịnh nộ và được cắn 2 người.');
  end if;
  if s.role = 'hunter' and p_cause <> 'poison' then
    update public.ww_rooms set pending_hunter = coalesce(pending_hunter, p_seat) where id = p_room;
  end if;

  if r.lovers is not null and p_seat = any (r.lovers) then
    partner := case when r.lovers[1] = p_seat then r.lovers[2] else r.lovers[1] end;
    perform public.ww__kill(p_room, partner, 'lover',
      format('💔 %s không chịu nổi nỗi đau mất người yêu (%s) nên đã chết theo! Vai: %s.',
        public.ww__name(p_room, partner), s.name,
        public.ww__role_label((select role from public.ww_seats where room_id = p_room and seat = partner))));
  end if;
end;
$$;

create or replace function public.ww__finish(p_room text, p_winner text)
returns void language plpgsql as $$
begin
  update public.ww_rooms set status = 'over', phase = 'over', step = '', deadline = null, winner = p_winner,
    acted = '{}', votes = '{}'::jsonb, pending_hunter = null, after_hunter = null
  where id = p_room;
  perform public.ww__say(p_room, 'narrator', case p_winner
    when 'village' then '☀️ Toàn bộ Sói đã bị loại. DÂN LÀNG CHIẾN THẮNG!'
    when 'lovers' then '💘 Chỉ còn đôi tình nhân sống sót. CẶP ĐÔI CHIẾN THẮNG!'
    else '🌑 Sói đã áp đảo dân làng. BẦY SÓI CHIẾN THẮNG!'
  end);
end;
$$;

/* ------------------------------- Bot ------------------------------- */

-- Bot ở bước đêm hiện tại hành động ngay khi bước bắt đầu.
create or replace function public.ww__bot_step(p_room text)
returns void language plpgsql as $$
declare
  r public.ww_rooms;
  b public.ww_seats;
  t integer;
  t2 integer;
  victim public.ww_seats;
begin
  select * into r from public.ww_rooms where id = p_room;

  if r.step = 'cupid' then
    select * into b from public.ww_seats where room_id = p_room and alive and is_bot and role = 'cupid' limit 1;
    if found and not r.cupid_done then
      t := public.ww__rand_seat(p_room);
      t2 := public.ww__rand_seat(p_room, array[t]);
      if t2 is not null then
        update public.ww_rooms set lovers = array[t, t2], cupid_done = true, acted = acted || b.seat where id = p_room;
        perform public.ww__notify_lovers(p_room);
      end if;
    end if;

  elsif r.step = 'guard' then
    select * into b from public.ww_seats where room_id = p_room and alive and is_bot and role = 'guard' limit 1;
    if found then
      update public.ww_rooms set guard_target = public.ww__rand_seat(p_room, array[coalesce(r.last_guarded, -1)]), acted = acted || b.seat
      where id = p_room;
    end if;

  elsif r.step = 'wolves' then
    -- Bầy bot thống nhất một con mồi; người thật trong bầy chọn thì bot đi theo.
    t := public.ww__rand_seat(p_room, '{}', false);
    if t is not null then
      update public.ww_rooms set wolf_votes = wolf_votes || coalesce((
        select jsonb_object_agg(seat::text, t) from public.ww_seats
        where room_id = p_room and alive and is_bot and public.ww__is_wolf(role)), '{}'::jsonb)
      where id = p_room;
    end if;

  elsif r.step = 'white_wolf' then
    select * into b from public.ww_seats where room_id = p_room and alive and is_bot and role = 'white_wolf' limit 1;
    if found and random() < 0.75 then
      update public.ww_rooms set white_target = public.ww__rand_seat(p_room, array[b.seat], true), acted = acted || b.seat
      where id = p_room;
    end if;

  elsif r.step = 'seer' then
    select * into b from public.ww_seats where room_id = p_room and alive and is_bot and role = 'seer' limit 1;
    if found then
      select seat into t from public.ww_seats
      where room_id = p_room and alive and seat <> b.seat
        and not (coalesce(r.seer_results -> b.seat::text, '{}'::jsonb) ? seat::text)
      order by random() limit 1;
      if t is not null then
        update public.ww_rooms set acted = acted || b.seat,
          seer_results = seer_results || jsonb_build_object(b.seat::text,
            coalesce(seer_results -> b.seat::text, '{}'::jsonb)
            || jsonb_build_object(t::text, public.ww__is_wolf((select role from public.ww_seats where room_id = p_room and seat = t))))
        where id = p_room;
      end if;
    end if;

  elsif r.step = 'witch' then
    select * into b from public.ww_seats where room_id = p_room and alive and is_bot and role = 'witch' limit 1;
    if found then
      select * into victim from public.ww_seats where room_id = p_room and seat = r.wolf_target;
      if victim.seat is not null and not r.heal_used and r.wolf_target is distinct from r.guard_target
         and (victim.seat = b.seat or victim.role = 'elder' or (r.day = 1 and random() < 0.65) or random() < 0.25) then
        update public.ww_rooms set healed = true, heal_used = true where id = p_room;
      end if;
      if not r.poison_used and r.day >= 2 and random() < 0.2 then
        update public.ww_rooms set poison_target = public.ww__rand_seat(p_room, array[b.seat]), poison_used = true where id = p_room;
      end if;
      update public.ww_rooms set heal_decided = true, acted = acted || b.seat where id = p_room;
    end if;
  end if;
end;
$$;

-- Bot nói một câu trong lúc thảo luận.
create or replace function public.ww__bot_chat(p_room text)
returns void language plpgsql as $$
declare
  r public.ww_rooms;
  b public.ww_seats;
  x text;
  dead text;
  roll double precision := random();
  line text;
  accuse text[] := array[
    'Mình thấy {X} hơi sus 🤨', '{X} im im từ sáng, nghi lắm nha', 'Vote {X} đi anh em, linh cảm mạnh',
    '{X} nói chuyện y chang sói hôm qua', 'Ai thấy {X} lấp lửng không? Mình thấy đó', 'Phiếu của mình cho {X}, không bàn cãi'];
  rip text[] := array['RIP {D} 🕯️ đêm qua căng thật', 'Tội {D}, chưa kịp nói gì', '{D} ra đi, sói chọn kỹ ghê'];
  calm text[] := array[
    'Bình tĩnh phân tích nào mọi người', 'Ai có info gì chia sẻ đi', 'Đêm nay Bảo Vệ cố lên 🙏',
    'Hôm nay vote trật là toang', 'Mình dân thường thôi mà 😭', 'Thề có KPI, mình trong sạch'];
begin
  select * into r from public.ww_rooms where id = p_room;
  select * into b from public.ww_seats where room_id = p_room and alive and is_bot order by random() limit 1;
  if found then
    select name into x from public.ww_seats
      where room_id = p_room and alive and seat <> b.seat and (not public.ww__is_wolf(b.role) or not public.ww__is_wolf(role))
      order by random() limit 1;
    select name into dead from public.ww_seats
      where room_id = p_room and not alive and died_day = r.day and cause in ('wolf', 'white_wolf', 'poison', 'lover')
      order by random() limit 1;
    line := case
      when dead is not null and roll < 0.25 then replace(rip[1 + floor(random() * array_length(rip, 1))::int], '{D}', dead)
      when x is not null and roll < 0.7 then replace(accuse[1 + floor(random() * array_length(accuse, 1))::int], '{X}', x)
      else calm[1 + floor(random() * array_length(calm, 1))::int]
    end;
    perform public.ww__say(p_room, 'chat', line, b.seat);
  end if;
  update public.ww_rooms set next_bot_chat = now() + make_interval(secs => 6 + random() * 8) where id = p_room;
end;
$$;

/* --------------------------- Máy trạng thái --------------------------- */

create or replace function public.ww__step_applies(p_room text, p_step text)
returns boolean language plpgsql stable as $$
declare
  r public.ww_rooms;
begin
  select * into r from public.ww_rooms where id = p_room;
  return case p_step
    when 'cupid' then r.day = 1 and not r.cupid_done and r.roles ? 'cupid'
    when 'white_wolf' then r.day % 2 = 0
      and exists (select 1 from public.ww_seats where room_id = p_room and alive and role = 'white_wolf')
    when 'wolves' then true
    else r.roles ? p_step
  end;
end;
$$;

-- Bắt đầu một bước đêm. Bước có người thật còn sống được 25s; bước của bot / vai đã chết
-- vẫn kéo 8-11s để không ai đoán được vai qua nhịp thời gian.
create or replace function public.ww__begin_step(p_room text, p_step text)
returns void language plpgsql as $$
begin
  update public.ww_rooms set
    step = p_step, acted = '{}', step_started_at = now(),
    deadline = now() + case
      when exists (select 1 from public.ww_seats where room_id = p_room and alive and not is_bot and public.ww__acts_in(role, p_step))
        then interval '25 seconds'
      else make_interval(secs => 8 + random() * 3)
    end
  where id = p_room;
  perform public.ww__bot_step(p_room);
end;
$$;

create or replace function public.ww__resolve_night(p_room text)
returns void language plpgsql as $$
declare
  r public.ww_rooms;
  target public.ww_seats;
  lives integer;
  extra integer;
  n_dead integer;
begin
  select * into r from public.ww_rooms where id = p_room;
  -- Xoá trạng thái đêm trước khi áp cái chết (Sói Con chết đêm nay vẫn giữ được cú cắn kép đêm sau).
  update public.ww_rooms set
    last_guarded = r.guard_target, guard_target = null, wolf_votes = '{}'::jsonb, wolf_target = null, wolf_bonus = 0,
    white_target = null, healed = false, heal_decided = false, poison_target = null, acted = '{}', step = '',
    phase = 'dawn', deadline = now() + interval '7 seconds'
  where id = p_room;
  select count(*) into n_dead from public.ww_seats where room_id = p_room and not alive;

  if r.wolf_target is not null and r.wolf_target is distinct from r.guard_target and not r.healed then
    select * into target from public.ww_seats where room_id = p_room and seat = r.wolf_target;
    lives := coalesce((r.elder_lives ->> r.wolf_target::text)::int, 2);
    if target.role = 'elder' and lives > 1 then
      update public.ww_rooms set elder_lives = elder_lives || jsonb_build_object(r.wolf_target::text, lives - 1) where id = p_room;
      perform public.ww__say(p_room, 'narrator', format('🛡️ Già Làng %s bị bầy Sói cắn nhưng kiên cường sống sót nhờ 2 mạng!', target.name));
    else
      perform public.ww__kill(p_room, r.wolf_target, 'wolf');
    end if;
  end if;

  if r.wolf_bonus > 0 then
    extra := public.ww__rand_seat(p_room, array_remove(array[r.wolf_target, r.guard_target], null), false);
    if extra is not null then perform public.ww__kill(p_room, extra, 'wolf'); end if;
  end if;

  if r.white_target is not null then perform public.ww__kill(p_room, r.white_target, 'white_wolf'); end if;
  if r.poison_target is not null then perform public.ww__kill(p_room, r.poison_target, 'poison'); end if;

  if (select count(*) from public.ww_seats where room_id = p_room and not alive) = n_dead then
    perform public.ww__say(p_room, 'narrator', '☀️ Trời sáng. Một đêm bình yên — không ai chết!');
  end if;
end;
$$;

-- Sang bước đêm kế tiếp (hoặc trời sáng).
create or replace function public.ww__next_step(p_room text)
returns void language plpgsql as $$
declare
  r public.ww_rooms;
  steps text[] := array['cupid', 'guard', 'wolves', 'white_wolf', 'seer', 'witch'];
  i integer;
begin
  select * into r from public.ww_rooms where id = p_room;
  if r.step = 'wolves' then
    -- Con mồi = ghế được nhiều Sói (còn sống) chọn nhất; hoà thì bốc ngẫu nhiên.
    update public.ww_rooms set wolf_target = (
      select (v.value #>> '{}')::int from jsonb_each(r.wolf_votes) v
      join public.ww_seats s on s.room_id = p_room and s.seat = v.key::int and s.alive and public.ww__is_wolf(s.role)
      where jsonb_typeof(v.value) = 'number'
      group by 1 order by count(*) desc, random() limit 1)
    where id = p_room;
  elsif r.step = 'cupid' and r.lovers is not null then
    perform public.ww__say(p_room, 'narrator', '💘 Thần Tình Yêu đã bí mật se duyên cho hai người trong làng.');
  end if;

  i := coalesce(array_position(steps, nullif(r.step, '')), 0);
  loop
    i := i + 1;
    if i > array_length(steps, 1) then
      perform public.ww__resolve_night(p_room);
      return;
    end if;
    if public.ww__step_applies(p_room, steps[i]) then
      perform public.ww__begin_step(p_room, steps[i]);
      return;
    end if;
  end loop;
end;
$$;

create or replace function public.ww__begin_night(p_room text, p_day integer)
returns void language plpgsql as $$
begin
  update public.ww_rooms set day = p_day, phase = 'night', step = '', votes = '{}'::jsonb, verdict = null, acted = '{}'
  where id = p_room;
  update public.ww_seats set ready = false where room_id = p_room;
  perform public.ww__say(p_room, 'narrator', format('🌙 Đêm %s buông xuống. Cả làng nhắm mắt…', p_day));
  perform public.ww__next_step(p_room);
end;
$$;

create or replace function public.ww__begin_discussion(p_room text)
returns void language plpgsql as $$
begin
  update public.ww_rooms set phase = 'discussion', step = '', acted = '{}',
    deadline = now() + case when public.ww__humans_alive(p_room) then interval '90 seconds' else interval '10 seconds' end,
    next_bot_chat = now() + interval '3 seconds'
  where id = p_room;
  update public.ww_seats set ready = false where room_id = p_room;
  perform public.ww__say(p_room, 'narrator',
    format('💬 Ngày %s: thảo luận rồi bỏ phiếu.', (select day from public.ww_rooms where id = p_room)));
end;
$$;

create or replace function public.ww__begin_vote(p_room text)
returns void language plpgsql as $$
declare
  wolf_pick integer := public.ww__rand_seat(p_room, '{}', false);
begin
  update public.ww_rooms set phase = 'vote', votes = coalesce((
      select jsonb_object_agg(seat::text, case
        when public.ww__is_wolf(role) then to_jsonb(wolf_pick)
        when random() < 0.3 then 'null'::jsonb
        else to_jsonb(public.ww__rand_seat(p_room, array[seat]))
      end)
      from public.ww_seats where room_id = p_room and alive and is_bot), '{}'::jsonb),
    deadline = now() + case when public.ww__humans_alive(p_room) then interval '30 seconds' else interval '4 seconds' end
  where id = p_room;
  perform public.ww__say(p_room, 'narrator', '🗳️ Bỏ phiếu kín! Người nhiều phiếu nhất bị trục xuất, hoà phiếu thì không ai chết.');
end;
$$;

-- Kiểm phiếu: ai chưa bầu coi như phiếu trắng. Kết quả công khai trong pha verdict.
create or replace function public.ww__resolve_vote(p_room text)
returns void language plpgsql as $$
declare
  r public.ww_rooms;
  tally jsonb;
  top_n integer;
  n_top integer;
  executed integer;
begin
  select * into r from public.ww_rooms where id = p_room;
  with v as (
    select e.key::int as voter, (e.value #>> '{}')::int as target
    from jsonb_each(r.votes) e
    join public.ww_seats s on s.room_id = p_room and s.seat = e.key::int and s.alive
    where jsonb_typeof(e.value) = 'number'
  ), t as (
    select target, count(*)::int as n, array_agg(voter order by voter) as voters from v group by target
  )
  select coalesce(jsonb_agg(jsonb_build_object('seat', target, 'votes', n, 'by', to_jsonb(voters)) order by n desc, target), '[]'::jsonb),
         coalesce(max(n), 0)
    into tally, top_n from t;
  select count(*) into n_top from jsonb_array_elements(tally) e where (e ->> 'votes')::int = top_n;
  if top_n > 0 and n_top = 1 then executed := (tally -> 0 ->> 'seat')::int; end if;

  update public.ww_rooms set phase = 'verdict', deadline = now() + interval '12 seconds',
    verdict = jsonb_build_object(
      'executed', executed,
      'tie', executed is null and top_n > 0,
      'tally', tally,
      'votes', top_n,
      'role', (select role from public.ww_seats where room_id = p_room and seat = executed))
  where id = p_room;
end;
$$;

-- Sau khi có người chết: kết thúc ván, chờ Thợ Săn bắn, hoặc đi tiếp.
create or replace function public.ww__after_deaths(p_room text, p_next text)
returns void language plpgsql as $$
declare
  w text := public.ww__check_winner(p_room);
  h integer;
begin
  if w is not null then
    perform public.ww__finish(p_room, w);
    return;
  end if;
  select pending_hunter into h from public.ww_rooms where id = p_room;
  if h is not null then
    update public.ww_rooms set phase = 'hunter', step = '', after_hunter = p_next, acted = '{}',
      deadline = now() + case
        when exists (select 1 from public.ww_seats where room_id = p_room and seat = h and not is_bot) then interval '20 seconds'
        else make_interval(secs => 3 + random() * 2)
      end
    where id = p_room;
    perform public.ww__say(p_room, 'narrator', format('🏹 Thợ Săn %s giương cung trước khi gục xuống…', public.ww__name(p_room, h)));
    return;
  end if;
  if p_next = 'night' then
    perform public.ww__begin_night(p_room, (select day from public.ww_rooms where id = p_room) + 1);
  else
    perform public.ww__begin_discussion(p_room);
  end if;
end;
$$;

create or replace function public.ww__hunter_shoot(p_room text, p_target integer)
returns void language plpgsql as $$
declare
  r public.ww_rooms;
  hname text;
  t public.ww_seats;
begin
  select * into r from public.ww_rooms where id = p_room;
  if r.pending_hunter is null then return; end if;
  hname := public.ww__name(p_room, r.pending_hunter);
  update public.ww_rooms set pending_hunter = null, after_hunter = null where id = p_room;
  select * into t from public.ww_seats where room_id = p_room and seat = p_target and alive;
  if t.seat is not null then
    perform public.ww__kill(p_room, t.seat, 'hunter',
      format('🏹 Thợ Săn %s bắn hạ %s! Vai: %s.', hname, t.name, public.ww__role_label(t.role)));
  else
    perform public.ww__say(p_room, 'narrator', format('🏹 Thợ Săn %s quyết định không bắn.', hname));
  end if;
  perform public.ww__after_deaths(p_room, coalesce(r.after_hunter, 'discussion'));
end;
$$;

-- Hết hạn pha / bước: áp hành động mặc định và đi tiếp.
create or replace function public.ww__on_deadline(p_room text)
returns void language plpgsql as $$
declare
  r public.ww_rooms;
  h public.ww_seats;
begin
  select * into r from public.ww_rooms where id = p_room;
  if r.phase = 'reveal' then
    perform public.ww__begin_night(p_room, 1);
  elsif r.phase = 'night' then
    perform public.ww__next_step(p_room);
  elsif r.phase = 'dawn' then
    perform public.ww__after_deaths(p_room, 'discussion');
  elsif r.phase = 'discussion' then
    perform public.ww__begin_vote(p_room);
  elsif r.phase = 'vote' then
    perform public.ww__resolve_vote(p_room);
  elsif r.phase = 'verdict' then
    if (r.verdict ->> 'executed') is not null then
      perform public.ww__kill(p_room, (r.verdict ->> 'executed')::int, 'vote',
        format('🪢 %s bị trục xuất với %s phiếu. Vai thật: %s.',
          public.ww__name(p_room, (r.verdict ->> 'executed')::int), r.verdict ->> 'votes', public.ww__role_label(r.verdict ->> 'role')));
    elsif (r.verdict ->> 'tie')::boolean then
      perform public.ww__say(p_room, 'narrator', '⚖️ Hoà phiếu — không ai bị trục xuất hôm nay.');
    else
      perform public.ww__say(p_room, 'narrator', '⚖️ Không ai nhận phiếu — không ai bị trục xuất.');
    end if;
    perform public.ww__after_deaths(p_room, 'night');
  elsif r.phase = 'hunter' then
    select * into h from public.ww_seats where room_id = p_room and seat = r.pending_hunter;
    if h.seat is null then
      perform public.ww__after_deaths(p_room, coalesce(r.after_hunter, 'discussion'));
    else
      perform public.ww__hunter_shoot(p_room, case when h.is_bot then public.ww__rand_seat(p_room, array[h.seat]) end);
    end if;
  else
    update public.ww_rooms set deadline = null where id = p_room;
  end if;
end;
$$;

-- Đẩy ván tới hiện tại theo giờ server. Trả về true nếu có gì thay đổi.
create or replace function public.ww__advance(p_room text)
returns boolean language plpgsql as $$
declare
  r public.ww_rooms;
  changed boolean := false;
  guard_n integer := 0;
begin
  select * into r from public.ww_rooms where id = p_room;
  if not found or r.status <> 'playing' then return false; end if;
  if not ((r.deadline is not null and r.deadline <= now()) or (r.phase = 'discussion' and r.next_bot_chat <= now())) then
    return false;
  end if;
  loop
    guard_n := guard_n + 1;
    exit when guard_n > 12;
    select * into r from public.ww_rooms where id = p_room for update;
    exit when r.status <> 'playing';
    if r.deadline is not null and r.deadline <= now() then
      perform public.ww__on_deadline(p_room);
      changed := true;
      continue;
    end if;
    if r.phase = 'discussion' and r.next_bot_chat is not null and r.next_bot_chat <= now() then
      perform public.ww__bot_chat(p_room);
      changed := true;
    end if;
    exit;
  end loop;
  if changed then perform public.ww__bump(p_room); end if;
  return changed;
end;
$$;

-- Người thật ở bước hiện tại đã hành động hết → rút ngắn hạn (vẫn giữ tối thiểu 8s mỗi bước).
create or replace function public.ww__maybe_hurry(p_room text)
returns void language plpgsql as $$
declare
  r public.ww_rooms;
begin
  select * into r from public.ww_rooms where id = p_room;
  if r.phase = 'night' then
    if not exists (
      select 1 from public.ww_seats
      where room_id = p_room and alive and not is_bot and public.ww__acts_in(role, r.step) and not (seat = any (r.acted))
    ) then
      update public.ww_rooms set deadline = least(deadline, greatest(now() + interval '2 seconds', step_started_at + interval '8 seconds'))
      where id = p_room;
    end if;
  elsif r.phase = 'vote' then
    if not exists (select 1 from public.ww_seats where room_id = p_room and alive and not is_bot and not (r.votes ? seat::text)) then
      update public.ww_rooms set deadline = least(deadline, now() + interval '1 second') where id = p_room;
    end if;
  end if;
end;
$$;

-- Phần người xem `p_me` được thấy. Không bao giờ chứa vai của người khác, trừ:
-- đồng đội Sói (nếu mình là Sói), người đã chết (vai đã công bố), và khi ván kết thúc.
create or replace function public.ww__view(p_room text, p_me text, p_since bigint default 0)
returns jsonb language plpgsql stable as $$
declare
  r public.ww_rooms;
  s public.ww_seats;
  my_wolf boolean;
  ended boolean;
  sees_lovers boolean;
  priv jsonb;
  seats jsonb;
  logs jsonb;
begin
  select * into r from public.ww_rooms where id = p_room;
  if not found then return null; end if;
  select * into s from public.ww_seats where room_id = p_room and user_id = p_me;
  my_wolf := public.ww__is_wolf(s.role);
  ended := r.phase = 'over';
  sees_lovers := r.lovers is not null and (ended or s.role = 'cupid' or s.seat = any (r.lovers));

  select coalesce(jsonb_agg(jsonb_build_object(
      'seat', x.seat,
      'name', x.name,
      'avatar', x.avatar,
      'bot', x.is_bot,
      'me', coalesce(x.user_id = p_me, false),
      'host', coalesce(x.user_id = r.host, false),
      'alive', x.alive,
      'cause', x.cause,
      'diedDay', x.died_day,
      'online', x.is_bot or x.last_seen > now() - interval '20 seconds',
      'ready', r.phase = 'discussion' and x.ready,
      'voted', r.phase = 'vote' and r.votes ? x.seat::text,
      'role', case when ended or coalesce(x.user_id = p_me, false) or not x.alive or (my_wolf and public.ww__is_wolf(x.role)) then x.role end,
      'lover', sees_lovers and x.seat = any (r.lovers)
    ) order by x.seat), '[]'::jsonb)
    into seats from public.ww_seats x where x.room_id = p_room;

  priv := jsonb_build_object('seat', s.seat, 'role', s.role, 'acted', coalesce(s.seat = any (r.acted), false));
  if s.role = 'guard' then priv := priv || jsonb_build_object('lastGuarded', r.last_guarded); end if;
  if my_wolf and r.phase = 'night' then
    priv := priv || jsonb_build_object('wolfVotes', r.wolf_votes, 'wolfBonus', r.wolf_bonus);
  end if;
  if s.role = 'seer' then priv := priv || jsonb_build_object('seerResults', coalesce(r.seer_results -> s.seat::text, '{}'::jsonb)); end if;
  if s.role = 'witch' then
    priv := priv || jsonb_build_object(
      'healUsed', r.heal_used, 'poisonUsed', r.poison_used, 'healDecided', r.heal_decided, 'healed', r.healed,
      'victim', case when r.phase = 'night' and r.step = 'witch' then r.wolf_target end);
  end if;
  if sees_lovers then priv := priv || jsonb_build_object('lovers', to_jsonb(r.lovers)); end if;
  if r.phase = 'vote' and s.seat is not null and r.votes ? s.seat::text then
    priv := priv || jsonb_build_object('myVote', r.votes -> s.seat::text);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'day', l.day, 'kind', l.kind, 'speaker', l.speaker, 'text', l.text, 'private', l.visible_to is not null
    ) order by l.id), '[]'::jsonb)
    into logs
    from (
      select * from public.ww_log l
      where l.room_id = p_room and l.id > coalesce(p_since, 0)
        and (l.visible_to is null or s.seat = any (l.visible_to))
      order by l.id desc limit 300
    ) l;

  return jsonb_build_object(
    'ok', true,
    'server_now', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    'room', jsonb_build_object(
      'id', r.id, 'isHost', r.host = p_me, 'status', r.status, 'phase', r.phase, 'step', r.step, 'day', r.day,
      'deadline', case when r.deadline is not null then floor(extract(epoch from r.deadline) * 1000)::bigint end,
      'roles', r.roles, 'winner', r.winner, 'gameNo', r.game_no, 'seq', r.seq,
      'pendingHunter', case when r.phase = 'hunter' then r.pending_hunter end,
      'verdict', case when r.phase = 'verdict' then r.verdict end),
    'me', priv,
    'seats', seats,
    'log', logs);
end;
$$;

-- Rời mọi phòng chờ khác (một người chỉ ngồi một phòng chờ).
create or replace function public.ww__leave_lobbies(p_me text, p_keep text)
returns void language plpgsql as $$
declare
  x record;
begin
  for x in
    select s.room_id from public.ww_seats s join public.ww_rooms r on r.id = s.room_id
    where s.user_id = p_me and r.status = 'lobby' and r.id <> coalesce(p_keep, '')
  loop
    perform public.ww_leave(x.room_id);
  end loop;
end;
$$;

create or replace function public.ww__free_seat(p_room text)
returns integer language sql stable as $$
  select min(g)::int from generate_series(0, 15) g
  where not exists (select 1 from public.ww_seats where room_id = p_room and seat = g);
$$;

create or replace function public.ww__add_bot(p_room text)
returns void language plpgsql as $$
declare
  names text[] := array['Linh HR', 'Tuấn Dev', 'Minh Sale', 'Trang Design', 'Hùng Kế Toán', 'Mai Marketing', 'Quân DevOps', 'Vy Content',
    'Long BA', 'Thảo PM', 'Khoa QA', 'Ngọc Legal', 'Duy Data', 'Hà Admin', 'Phúc Intern', 'An CEO'];
  nm text;
  st integer := public.ww__free_seat(p_room);
begin
  select n into nm from unnest(names) n
    where not exists (select 1 from public.ww_seats where room_id = p_room and name = n)
    order by random() limit 1;
  nm := coalesce(nm, 'Bot ' || st);
  insert into public.ww_seats (room_id, seat, user_id, name, avatar, is_bot)
  values (p_room, st, null, nm, 'kokonut:' || lower(nm) || ':' || st, true);
end;
$$;

-- --------------------------------------------------------------------
-- 3. RPC CHO CLIENT
-- --------------------------------------------------------------------

-- Đọc phòng. p_since = id nhật ký cuối client đã có (chỉ trả phần mới).
create or replace function public.ww_state(p_room text, p_since bigint default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
begin
  if me is null or not exists (select 1 from public.ww_seats where room_id = p_room and user_id = me) then
    return null;
  end if;
  perform public.ww__advance(p_room);
  update public.ww_seats set last_seen = now()
    where room_id = p_room and user_id = me and last_seen < now() - interval '5 seconds';
  return public.ww__view(p_room, me, p_since);
end;
$$;

create or replace function public.ww_create(p_name text, p_avatar text, p_roles jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  err text := public.ww__validate_roles(p_roles);
  code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if err is not null then raise exception '%', err; end if;

  -- Dọn phòng bỏ hoang.
  update public.ww_rooms set status = 'closed', deadline = null
    where status <> 'closed' and updated_at < now() - interval '3 hours';
  perform public.ww__leave_lobbies(me, null);

  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.ww_rooms where id = code);
  end loop;

  insert into public.ww_rooms (id, host, roles) values (code, me, p_roles);
  insert into public.ww_seats (room_id, seat, user_id, name, avatar)
    values (code, 0, me, left(coalesce(nullif(trim(p_name), ''), 'Người chơi'), 40), coalesce(p_avatar, ''));
  perform public.ww__say(code, 'narrator', format('🏠 %s đã mở phòng %s.', public.ww__name(code, 0), code));
  perform public.ww__bump(code);
  return public.ww__view(code, me, 0);
end;
$$;

create or replace function public.ww_join(p_room text, p_name text, p_avatar text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  rid text := upper(trim(p_room));
  r public.ww_rooms;
  s public.ww_seats;
  st integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into r from public.ww_rooms where id = rid for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.status = 'closed' then raise exception 'room_closed'; end if;

  select * into s from public.ww_seats where room_id = rid and user_id = me;
  if found then
    -- Vào lại: lấy lại ghế từ bot (nếu trước đó đã rời giữa ván).
    if s.is_bot then
      update public.ww_seats set is_bot = false, last_seen = now() where room_id = rid and seat = s.seat;
      perform public.ww__say(rid, 'narrator', format('🔌 %s đã quay lại bàn.', s.name));
    else
      update public.ww_seats set last_seen = now() where room_id = rid and seat = s.seat;
    end if;
    perform public.ww__bump(rid);
    return public.ww__view(rid, me, 0);
  end if;

  if r.status <> 'lobby' then raise exception 'room_started'; end if;
  if (select count(*) from public.ww_seats where room_id = rid) >= jsonb_array_length(r.roles) then
    raise exception 'room_full';
  end if;
  perform public.ww__leave_lobbies(me, rid);
  st := public.ww__free_seat(rid);
  insert into public.ww_seats (room_id, seat, user_id, name, avatar)
    values (rid, st, me, left(coalesce(nullif(trim(p_name), ''), 'Người chơi'), 40), coalesce(p_avatar, ''));
  perform public.ww__say(rid, 'narrator', format('👋 %s vào phòng.', public.ww__name(rid, st)));
  perform public.ww__bump(rid);
  return public.ww__view(rid, me, 0);
end;
$$;

-- Rời phòng. Phòng chờ: nhả ghế (chủ phòng rời thì chuyển chủ). Đang chơi: bot chơi thay
-- cho tới khi người đó vào lại bằng ww_join.
create or replace function public.ww_leave(p_room text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r public.ww_rooms;
  s public.ww_seats;
  heir text;
begin
  if me is null then return; end if;
  select * into r from public.ww_rooms where id = p_room for update;
  if not found then return; end if;
  select * into s from public.ww_seats where room_id = p_room and user_id = me;
  if not found then return; end if;

  if r.status = 'playing' then
    update public.ww_seats set is_bot = true where room_id = p_room and seat = s.seat;
    perform public.ww__say(p_room, 'narrator', format('🤖 %s rời bàn — bot chơi thay.', s.name));
  elsif r.status = 'lobby' then
    delete from public.ww_seats where room_id = p_room and seat = s.seat;
    perform public.ww__say(p_room, 'narrator', format('🚪 %s rời phòng.', s.name));
  end if;

  if r.host = me and r.status in ('lobby', 'over') then
    select user_id into heir from public.ww_seats
      where room_id = p_room and user_id is not null and user_id <> me and not is_bot
      order by last_seen desc limit 1;
    if heir is null then
      update public.ww_rooms set status = 'closed', deadline = null where id = p_room;
    else
      update public.ww_rooms set host = heir where id = p_room;
    end if;
  end if;
  perform public.ww__bump(p_room);
end;
$$;

create or replace function public.ww_add_bot(p_room text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r public.ww_rooms;
begin
  select * into r from public.ww_rooms where id = p_room for update;
  if not found or r.host is distinct from me then raise exception 'not_host'; end if;
  if r.status <> 'lobby' then raise exception 'room_started'; end if;
  if (select count(*) from public.ww_seats where room_id = p_room) >= jsonb_array_length(r.roles) then
    raise exception 'room_full';
  end if;
  perform public.ww__add_bot(p_room);
  perform public.ww__bump(p_room);
  return public.ww__view(p_room, me, null);
end;
$$;

create or replace function public.ww_kick(p_room text, p_seat integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r public.ww_rooms;
begin
  select * into r from public.ww_rooms where id = p_room for update;
  if not found or r.host is distinct from me then raise exception 'not_host'; end if;
  if r.status <> 'lobby' then raise exception 'room_started'; end if;
  delete from public.ww_seats where room_id = p_room and seat = p_seat and user_id is distinct from me;
  perform public.ww__bump(p_room);
  return public.ww__view(p_room, me, null);
end;
$$;

create or replace function public.ww_set_roles(p_room text, p_roles jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r public.ww_rooms;
  err text := public.ww__validate_roles(p_roles);
begin
  select * into r from public.ww_rooms where id = p_room for update;
  if not found or r.host is distinct from me then raise exception 'not_host'; end if;
  if r.status <> 'lobby' then raise exception 'room_started'; end if;
  if err is not null then raise exception '%', err; end if;
  if (select count(*) from public.ww_seats where room_id = p_room) > jsonb_array_length(p_roles) then
    raise exception 'too_many_players';
  end if;
  update public.ww_rooms set roles = p_roles where id = p_room;
  perform public.ww__bump(p_room);
  return public.ww__view(p_room, me, null);
end;
$$;

-- Bắt đầu ván. Thiếu người thì (p_fill_bots) điền bot cho đủ bộ vai.
create or replace function public.ww_start(p_room text, p_fill_bots boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r public.ww_rooms;
  n integer;
begin
  select * into r from public.ww_rooms where id = p_room for update;
  if not found or r.host is distinct from me then raise exception 'not_host'; end if;
  if r.status <> 'lobby' then raise exception 'room_started'; end if;
  n := jsonb_array_length(r.roles);
  if p_fill_bots then
    while (select count(*) from public.ww_seats where room_id = p_room) < n loop
      perform public.ww__add_bot(p_room);
    end loop;
  end if;
  if (select count(*) from public.ww_seats where room_id = p_room) <> n then raise exception 'need_players'; end if;

  -- Chia vai ngẫu nhiên phía server.
  with roles as (
    select value as role, row_number() over (order by random()) as rn from jsonb_array_elements_text(r.roles)
  ), seats as (
    select seat, row_number() over (order by seat) as rn from public.ww_seats where room_id = p_room
  )
  update public.ww_seats x set role = roles.role, alive = true, cause = null, died_day = null, ready = false
  from seats join roles using (rn)
  where x.room_id = p_room and x.seat = seats.seat;

  delete from public.ww_log where room_id = p_room;
  update public.ww_rooms set
    status = 'playing', phase = 'reveal', step = '', day = 1, game_no = game_no + 1, winner = null,
    deadline = now() + interval '12 seconds', step_started_at = now(),
    acted = '{}', guard_target = null, last_guarded = null, wolf_votes = '{}'::jsonb, wolf_target = null, wolf_bonus = 0,
    white_target = null, seer_results = '{}'::jsonb, healed = false, heal_decided = false, heal_used = false,
    poison_target = null, poison_used = false, lovers = null, cupid_done = false,
    elder_lives = coalesce((select jsonb_object_agg(seat::text, 2) from public.ww_seats where room_id = p_room and role = 'elder'), '{}'::jsonb),
    pending_hunter = null, after_hunter = null, votes = '{}'::jsonb, verdict = null, next_bot_chat = null
  where id = p_room;
  perform public.ww__say(p_room, 'narrator', format('Làng có %s người, trong đó có %s con Sói. Mỗi người nhận một lá vai bí mật.',
    n, (select count(*) from jsonb_array_elements_text(r.roles) x where public.ww__is_wolf(x))));
  perform public.ww__bump(p_room);
  return public.ww__view(p_room, me, 0);
end;
$$;

-- Ván xong: chủ phòng đưa cả bàn về phòng chờ (người đã rời bàn bị nhả ghế).
create or replace function public.ww_rematch(p_room text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r public.ww_rooms;
begin
  select * into r from public.ww_rooms where id = p_room for update;
  if not found or r.host is distinct from me then raise exception 'not_host'; end if;
  if r.status <> 'over' then raise exception 'not_over'; end if;
  delete from public.ww_seats where room_id = p_room and user_id is not null and user_id <> me
    and (is_bot or last_seen < now() - interval '60 seconds');
  update public.ww_seats set role = null, alive = true, cause = null, died_day = null, ready = false where room_id = p_room;
  update public.ww_rooms set status = 'lobby', phase = 'lobby', step = '', day = 0, deadline = null, winner = null,
    verdict = null, lovers = null, game_no = game_no + 1 where id = p_room;
  delete from public.ww_log where room_id = p_room;
  perform public.ww__say(p_room, 'narrator', '🔁 Chủ phòng mở ván mới. Chờ mọi người rồi bắt đầu.');
  perform public.ww__bump(p_room);
  return public.ww__view(p_room, me, 0);
end;
$$;

-- Mọi hành động trong ván. Server kiểm tra pha, bước, vai, còn sống, mục tiêu hợp lệ.
--   vote       target|null    : bỏ phiếu / phiếu trắng
--   shoot      target|null    : Thợ Săn bắn / không bắn
--   cupid      target,target2 : se duyên (đêm 1)
--   guard      target         : bảo vệ (không trùng người đêm trước)
--   bite       target         : Sói chọn con mồi
--   white_bite target|null    : Sói Trắng trừ khử 1 Sói / bỏ qua
--   seer       target         : soi
--   heal       flag           : Phù Thủy cứu / không cứu nạn nhân của Sói
--   poison     target|null    : Phù Thủy đầu độc / bỏ qua (kết thúc lượt Phù Thủy)
create or replace function public.ww_act(
  p_room text,
  p_action text,
  p_target integer default null,
  p_target2 integer default null,
  p_flag boolean default false,
  p_since bigint default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r public.ww_rooms;
  s public.ww_seats;
  t public.ww_seats;
  ok boolean := false;
  res jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  perform public.ww__advance(p_room);
  select * into r from public.ww_rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  select * into s from public.ww_seats where room_id = p_room and user_id = me;
  if not found then raise exception 'not_in_room'; end if;
  if p_target is not null then
    select * into t from public.ww_seats where room_id = p_room and seat = p_target and alive;
  end if;

  if r.status <> 'playing' or s.is_bot then
    ok := false;

  elsif p_action = 'shoot' then
    if r.phase = 'hunter' and r.pending_hunter = s.seat and (p_target is null or (t.seat is not null and t.seat <> s.seat)) then
      perform public.ww__hunter_shoot(p_room, t.seat);
      ok := true;
    end if;

  elsif not s.alive then
    ok := false;

  elsif p_action = 'vote' then
    if r.phase = 'vote' and not (r.votes ? s.seat::text) and (p_target is null or (t.seat is not null and t.seat <> s.seat)) then
      update public.ww_rooms set votes = votes || jsonb_build_object(s.seat::text, t.seat) where id = p_room;
      perform public.ww__say(p_room, 'vote', format('🗳️ %s đã bỏ một lá phiếu kín.', s.name), s.seat);
      ok := true;
    end if;

  elsif r.phase = 'night' and not (s.seat = any (r.acted)) and public.ww__acts_in(s.role, r.step) then
    if p_action = 'cupid' and r.step = 'cupid' and not r.cupid_done then
      if t.seat is not null and p_target2 is not null and p_target2 <> t.seat
         and exists (select 1 from public.ww_seats where room_id = p_room and seat = p_target2 and alive) then
        update public.ww_rooms set lovers = array[t.seat, p_target2], cupid_done = true, acted = acted || s.seat where id = p_room;
        perform public.ww__notify_lovers(p_room);
        ok := true;
      end if;

    elsif p_action = 'guard' and r.step = 'guard' then
      if t.seat is not null and t.seat is distinct from r.last_guarded then
        update public.ww_rooms set guard_target = t.seat, acted = acted || s.seat where id = p_room;
        ok := true;
      end if;

    elsif p_action = 'bite' and r.step = 'wolves' then
      if t.seat is not null and not public.ww__is_wolf(t.role) then
        -- Bot trong bầy đi theo lựa chọn của người thật.
        update public.ww_rooms set acted = acted || s.seat,
          wolf_votes = wolf_votes || jsonb_build_object(s.seat::text, t.seat) || coalesce((
            select jsonb_object_agg(seat::text, t.seat) from public.ww_seats
            where room_id = p_room and alive and is_bot and public.ww__is_wolf(role)), '{}'::jsonb)
        where id = p_room;
        perform public.ww__say(p_room, 'wolf', format('🐺 %s chọn cắn %s.', s.name, t.name), s.seat, public.ww__wolf_seats(p_room));
        ok := true;
      end if;

    elsif p_action = 'white_bite' and r.step = 'white_wolf' then
      if p_target is null or (t.seat is not null and t.seat <> s.seat and public.ww__is_wolf(t.role)) then
        update public.ww_rooms set white_target = t.seat, acted = acted || s.seat where id = p_room;
        ok := true;
      end if;

    elsif p_action = 'seer' and r.step = 'seer' then
      if t.seat is not null and t.seat <> s.seat then
        update public.ww_rooms set acted = acted || s.seat,
          seer_results = seer_results || jsonb_build_object(s.seat::text,
            coalesce(seer_results -> s.seat::text, '{}'::jsonb) || jsonb_build_object(t.seat::text, public.ww__is_wolf(t.role))),
          deadline = least(deadline, greatest(now() + interval '4 seconds', step_started_at + interval '8 seconds'))
        where id = p_room;
        perform public.ww__say(p_room, 'private',
          format('🔮 Đêm %s: %s %s', r.day, t.name, case when public.ww__is_wolf(t.role) then 'là SÓI 🐺' else 'là người tốt ✅' end),
          null, array[s.seat]);
        ok := true;
      end if;

    elsif p_action = 'heal' and r.step = 'witch' then
      if not r.heal_decided then
        update public.ww_rooms set heal_decided = true,
          healed = p_flag and r.wolf_target is not null and not r.heal_used,
          heal_used = heal_used or (p_flag and r.wolf_target is not null)
        where id = p_room;
        -- Không còn bình Độc thì cứu xong là hết lượt.
        if r.poison_used then update public.ww_rooms set acted = acted || s.seat where id = p_room; end if;
        ok := true;
      end if;

    elsif p_action = 'poison' and r.step = 'witch' then
      if p_target is null or (t.seat is not null and t.seat <> s.seat and not r.poison_used) then
        update public.ww_rooms set heal_decided = true, acted = acted || s.seat,
          poison_target = t.seat, poison_used = poison_used or t.seat is not null
        where id = p_room;
        ok := true;
      end if;
    end if;
  end if;

  if ok then
    perform public.ww__maybe_hurry(p_room);
    perform public.ww__bump(p_room);
  end if;
  res := public.ww__view(p_room, me, p_since);
  return res || jsonb_build_object('ok', ok);
end;
$$;

-- Chat: ban ngày (thảo luận) cho người còn sống; ban đêm chỉ bầy Sói nói với nhau;
-- phòng chờ / hết ván ai cũng nói được.
create or replace function public.ww_chat(p_room text, p_text text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r public.ww_rooms;
  s public.ww_seats;
  msg text := left(trim(coalesce(p_text, '')), 200);
begin
  if me is null or msg = '' then return false; end if;
  perform public.ww__advance(p_room);
  select * into r from public.ww_rooms where id = p_room;
  select * into s from public.ww_seats where room_id = p_room and user_id = me;
  if not found or s.is_bot then return false; end if;
  if s.last_chat_at > now() - interval '700 milliseconds' then return false; end if;

  if r.status in ('lobby', 'over') or (r.phase = 'discussion' and s.alive) then
    perform public.ww__say(p_room, 'chat', msg, s.seat);
  elsif r.phase = 'night' and s.alive and public.ww__is_wolf(s.role) then
    perform public.ww__say(p_room, 'wolf', msg, s.seat, public.ww__wolf_seats(p_room));
  else
    return false;
  end if;
  update public.ww_seats set last_chat_at = now() where room_id = p_room and seat = s.seat;
  perform public.ww__bump(p_room);
  return true;
end;
$$;

-- Phòng đang dở của mình (để vào lại sau khi rớt mạng / tải lại trang).
create or replace function public.ww_resume()
returns text language sql stable security definer set search_path = public as $$
  select r.id from public.ww_seats s join public.ww_rooms r on r.id = s.room_id
  where s.user_id = auth.uid()::text and not s.is_bot and r.status in ('lobby', 'playing')
    and r.updated_at > now() - interval '3 hours'
  order by (r.status = 'playing') desc, r.updated_at desc limit 1;
$$;

-- Phòng chờ còn chỗ.
create or replace function public.ww_list_open()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x ->> 'updated' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', r.id,
      'host', (select name from public.ww_seats where room_id = r.id and user_id = r.host),
      'players', (select count(*) from public.ww_seats where room_id = r.id),
      'size', jsonb_array_length(r.roles),
      'updated', r.updated_at) as x
    from public.ww_rooms r
    where r.status = 'lobby' and r.updated_at > now() - interval '30 minutes'
      and (select count(*) from public.ww_seats where room_id = r.id) < jsonb_array_length(r.roles)
    order by r.updated_at desc limit 20
  ) q;
$$;

-- Dùng cho pg_cron (tuỳ chọn): đẩy mọi phòng đang chơi đã quá hạn.
create or replace function public.ww_tick_all()
returns integer language plpgsql security definer set search_path = public as $$
declare
  x record;
  n integer := 0;
begin
  for x in select id from public.ww_rooms where status = 'playing' and deadline <= now() loop
    if public.ww__advance(x.id) then n := n + 1; end if;
  end loop;
  return n;
end;
$$;

-- --------------------------------------------------------------------
-- 4. REALTIME: client nghe postgres_changes của ww_pulse (lọc theo room_id)
-- --------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ww_pulse') then
      alter publication supabase_realtime add table public.ww_pulse;
    end if;
  end if;
end $$;

-- --------------------------------------------------------------------
-- 5. QUYỀN GỌI HÀM
-- Hàm nội bộ ww__*: không ai ngoài owner được gọi. RPC: chỉ tài khoản đã đăng nhập.
-- --------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'ww\_%'
  loop
    execute format('revoke execute on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f.sig);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      if f.proname like 'ww\_\_%' or f.proname = 'ww_tick_all' then
        execute format('revoke execute on function %s from authenticated', f.sig);
      else
        execute format('grant execute on function %s to authenticated', f.sig);
      end if;
    end if;
  end loop;
end $$;

-- Tuỳ chọn: nếu đã bật extension pg_cron, bỏ comment để phòng tự chạy mỗi phút
-- kể cả khi không ai mở tab (bình thường client thăm dò đã đủ).
-- select cron.schedule('ww-tick', '* * * * *', $$select public.ww_tick_all()$$);

notify pgrst, 'reload schema';


-- ====================================================================
-- >>> spectate.sql
-- ====================================================================

-- ====================================================================
-- OFFICE ARENA - XEM TRẬN + VÒNG ĐỜI KÈO (tự huỷ khi bỏ dở)
-- Chạy SAU db/online.sql. Chạy lại nhiều lần vẫn an toàn.
--
--  - match_watch(id)   : người đã đăng nhập xem một trận (kể cả không phải người chơi)
--  - match_peek(ids)   : trạng thái gọn của nhiều trận (còn vào lại được hay chỉ xem)
--  - match_expire(id)  : huỷ trận bỏ dở (không ai đi nước quá 10 phút)
--  - chat_update_bet   : thêm acceptedAt / startedAt, cho người trong kèo huỷ kèo bỏ dở
-- ====================================================================

create or replace function public.match_watch(p_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m public.matches;
begin
  if auth.uid() is null then return null; end if;
  select * into m from public.matches where id = p_id;
  if not found then return null; end if;
  return public.match_json(m);
end;
$$;

drop function if exists public.match_peek(text[]);
create or replace function public.match_peek(p_ids text[])
returns table (id text, game text, status text, winner text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.game, m.status, m.winner, m.updated_at
  from public.matches m
  where auth.uid() is not null and m.id = any (p_ids[1:50]);
$$;

create or replace function public.match_expire(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  m public.matches;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  update public.matches
    set status = 'finished', winner = 'none', reason = 'abandoned', draw_offer_by = null, updated_at = now()
    where id = p_id and status = 'active' and me in (p1, p2) and updated_at < now() - interval '10 minutes'
    returning * into m;
  if not found then
    select * into m from public.matches where id = p_id;
    if not found then return null; end if;
  end if;
  return public.match_json(m);
end;
$$;

create or replace function public.chat_update_bet(p_bet jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r public.chat_messages;
  cur jsonb;
  nxt jsonb;
  want text := p_bet ->> 'status';
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
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
      'status', 'accepted', 'opponentId', me, 'acceptedAt', now_ms,
      'opponentName', p_bet ->> 'opponentName', 'opponentAvatar', p_bet ->> 'opponentAvatar');
  elsif cur ->> 'status' = 'pending' and want = 'cancelled' and me = cur ->> 'creatorId' then
    nxt := cur || jsonb_build_object('status', 'cancelled');
  elsif cur ->> 'status' in ('accepted', 'in_game') and want = 'cancelled'
     and me in (cur ->> 'creatorId', cur ->> 'opponentId') then
    -- Kèo bỏ dở (hết giờ phòng chờ / bỏ ván): mỗi bên tự hoàn tiền cược của mình.
    nxt := cur || jsonb_build_object('status', 'cancelled', 'cancelReason', coalesce(p_bet ->> 'cancelReason', 'expired'));
  elsif cur ->> 'status' = 'in_game' and want = 'in_game' then
    return cur;
  elsif cur ->> 'status' in ('accepted', 'in_game') and want in ('in_game', 'completed')
     and me in (cur ->> 'creatorId', cur ->> 'opponentId') then
    nxt := cur || jsonb_build_object('status', want);
    if want = 'in_game' then nxt := nxt || jsonb_build_object('startedAt', now_ms); end if;
    if p_bet ? 'winnerId' then nxt := nxt || jsonb_build_object('winnerId', p_bet -> 'winnerId'); end if;
  else
    return cur;
  end if;

  update public.chat_messages set payload = jsonb_set(payload, '{betChallenge}', nxt) where id = r.id;
  return nxt;
end;
$$;

revoke execute on function public.match_watch(text) from public, anon;
revoke execute on function public.match_peek(text[]) from public, anon;
revoke execute on function public.match_expire(text) from public, anon;
revoke execute on function public.chat_update_bet(jsonb) from public, anon;
grant execute on function public.match_watch(text) to authenticated;
grant execute on function public.match_peek(text[]) to authenticated;
grant execute on function public.match_expire(text) to authenticated;
grant execute on function public.chat_update_bet(jsonb) to authenticated;

notify pgrst, 'reload schema';


-- ====================================================================
-- >>> forfeit.sql
-- ====================================================================

-- ====================================================================
-- OFFICE ARENA - MA SÓI: XIN LUI GIỮA VÁN = CHẾT
-- Chạy SAU db/werewolf-online.sql. Chạy lại nhiều lần vẫn an toàn.
--
-- Trước đây rời bàn giữa ván thì bot chơi thay. Giờ người rời (xin lui) bị loại khỏi ván:
-- chết ngay, lộ vai, không được bắn (Thợ Săn), người yêu chết theo như luật thường;
-- nếu việc đó kết thúc ván thì công bố phe thắng luôn.
-- ====================================================================

create or replace function public.ww_leave(p_room text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  r public.ww_rooms;
  s public.ww_seats;
  heir text;
  w text;
begin
  if me is null then return; end if;
  select * into r from public.ww_rooms where id = p_room for update;
  if not found then return; end if;
  select * into s from public.ww_seats where room_id = p_room and user_id = me;
  if not found then return; end if;

  if r.status = 'playing' then
    if s.alive then
      perform public.ww__kill(p_room, s.seat, 'quit',
        format('🏳️ %s xin lui — coi như đã chết. Vai: %s.', s.name, public.ww__role_label(s.role)));
      -- Xin lui thì không được bắn mang theo.
      update public.ww_rooms set pending_hunter = null where id = p_room and pending_hunter = s.seat;
    end if;
    update public.ww_seats set is_bot = true where room_id = p_room and seat = s.seat;
    w := public.ww__check_winner(p_room);
    if w is not null then perform public.ww__finish(p_room, w); end if;
  elsif r.status = 'lobby' then
    delete from public.ww_seats where room_id = p_room and seat = s.seat;
    perform public.ww__say(p_room, 'narrator', format('🚪 %s rời phòng.', s.name));
  end if;

  if r.host = me and r.status in ('lobby', 'over') then
    select user_id into heir from public.ww_seats
      where room_id = p_room and user_id is not null and user_id <> me and not is_bot
      order by last_seen desc limit 1;
    if heir is null then
      update public.ww_rooms set status = 'closed', deadline = null where id = p_room;
    else
      update public.ww_rooms set host = heir where id = p_room;
    end if;
  end if;
  perform public.ww__bump(p_room);
end;
$$;

revoke execute on function public.ww_leave(text) from public, anon;
grant execute on function public.ww_leave(text) to authenticated;

notify pgrst, 'reload schema';

