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
