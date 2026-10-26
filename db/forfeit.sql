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
