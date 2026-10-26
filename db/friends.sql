-- ====================================================================
-- OFFICE ARENA - BẠN BÈ
-- Chạy SAU db/setup.sql. Chạy lại nhiều lần vẫn an toàn.
--
--  - oa_friends          : mỗi tình bạn là 2 dòng (a→b và b→a), kết bạn là thành bạn ngay
--  - friend_add(id)      : kết bạn tức thì (hai chiều)
--  - friend_remove(id)   : huỷ kết bạn (hai chiều)
-- ====================================================================

create table if not exists public.oa_friends (
  user_id text not null,
  friend_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists idx_oa_friends_friend on public.oa_friends (friend_id);

alter table public.oa_friends enable row level security;
drop policy if exists "Own friends read" on public.oa_friends;
create policy "Own friends read" on public.oa_friends for select to authenticated
  using (auth.uid()::text = user_id);
-- Không có policy insert/delete: chỉ qua RPC bên dưới.

create or replace function public.friend_add(p_friend text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
begin
  if me is null or p_friend is null or p_friend = me then return false; end if;
  if not exists (select 1 from public.oa_profiles where id = p_friend) then return false; end if;
  insert into public.oa_friends (user_id, friend_id) values (me, p_friend), (p_friend, me)
    on conflict do nothing;
  return true;
end;
$$;

create or replace function public.friend_remove(p_friend text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
begin
  if me is null then return false; end if;
  delete from public.oa_friends
    where (user_id = me and friend_id = p_friend) or (user_id = p_friend and friend_id = me);
  return true;
end;
$$;

revoke execute on function public.friend_add(text) from public, anon;
revoke execute on function public.friend_remove(text) from public, anon;
grant execute on function public.friend_add(text) to authenticated;
grant execute on function public.friend_remove(text) to authenticated;
grant select on public.oa_friends to authenticated;

-- Realtime: người kia kết bạn với mình thì danh sách của mình cập nhật ngay.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'oa_friends') then
      alter publication supabase_realtime add table public.oa_friends;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
