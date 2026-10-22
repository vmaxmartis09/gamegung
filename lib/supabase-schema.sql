-- ====================================================================
-- OFFICE ARENA - SUPABASE DATABASE SCHEMA
-- HỆ THỐNG TÍNH ĐIỂM ELO, RANKING, ĐẶT CƯỢC LÚA & GHÉP TRẬN MATCHMAKING
-- ====================================================================

-- 1. BẢNG HỒ SƠ NGƯỜI CHƠI (PROFILES)
create table if not exists public.profiles (
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
alter table public.profiles add column if not exists character jsonb default '{}'::jsonb;
alter table public.profiles add column if not exists inventory jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists lua bigint default 1000;
alter table public.profiles add column if not exists elo_chess integer default 1200;
alter table public.profiles add column if not exists elo_xiangqi integer default 1200;
alter table public.profiles add column if not exists elo_werewolf integer default 1000;
alter table public.profiles add column if not exists badges jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists equipped_badges jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists stats jsonb default '{"chess": {"wins": 0, "losses": 0, "draws": 0, "games": 0}, "xiangqi": {"wins": 0, "losses": 0, "draws": 0, "games": 0}, "werewolf": {"wins": 0, "losses": 0, "draws": 0, "games": 0}}'::jsonb;

-- 2. BẢNG LỊCH SỬ ĐẤU & ĐẶT CƯỢC (MATCH_HISTORY)
create table if not exists public.match_history (
  id uuid primary key default gen_random_uuid(),
  game_type text not null check (game_type in ('chess', 'xiangqi', 'werewolf', 'uno')),
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
  game_type text not null check (game_type in ('chess', 'xiangqi', 'werewolf', 'uno')),
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
create index if not exists idx_profiles_elo_chess on public.profiles (elo_chess desc);
create index if not exists idx_profiles_elo_xiangqi on public.profiles (elo_xiangqi desc);
create index if not exists idx_profiles_elo_werewolf on public.profiles (elo_werewolf desc);
create index if not exists idx_profiles_lua on public.profiles (lua desc);
create index if not exists idx_match_history_player on public.match_history (player_id, created_at desc);
create index if not exists idx_matchmaking_queue_lookup on public.matchmaking_queue (game_type, stake, status, created_at);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
alter table public.profiles enable row level security;
alter table public.match_history enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.transactions enable row level security;

-- Cho phép đọc công khai hồ sơ và bảng xếp hạng
create policy "Allow public read on profiles" on public.profiles
  for select using (true);

-- Cho phép người dùng upsert hồ sơ của mình
create policy "Allow upsert on profiles" on public.profiles
  for all using (true) with check (true);

-- Cho phép đọc và ghi lịch sử đấu
create policy "Allow public read on match_history" on public.match_history
  for select using (true);

create policy "Allow insert on match_history" on public.match_history
  for insert with check (true);

-- Cho phép thao tác trên hàng chờ ghép trận
create policy "Allow all on matchmaking_queue" on public.matchmaking_queue
  for all using (true) with check (true);

-- Cho phép đọc và ghi lịch sử giao dịch
create policy "Allow all on transactions" on public.transactions
  for all using (true) with check (true);

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
before update on public.profiles
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
  -- Khóa dòng người dùng để tránh race-condition (double-claim)
  select * into v_profile
  from public.profiles
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
  update public.profiles
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
before update on public.profiles
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
    from public.profiles
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

    update public.profiles
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
alter table public.profiles add column if not exists elo_arcade integer default 1200;
alter table public.profiles add column if not exists elo_uno integer default 1200;

-- ====================================================================
-- (KHUYẾN NGHỊ) SIẾT RLS: mỗi tài khoản chỉ được ghi hồ sơ / lịch sử của chính mình.
-- App giờ bắt buộc đăng nhập Supabase Auth nên có thể bật ngay.
-- ====================================================================
-- drop policy if exists "Allow upsert on profiles" on public.profiles;
-- create policy "Own profile insert" on public.profiles for insert with check (auth.uid()::text = id);
-- create policy "Own profile update" on public.profiles for update using (auth.uid()::text = id) with check (auth.uid()::text = id);
-- drop policy if exists "Allow insert on match_history" on public.match_history;
-- create policy "Own match insert" on public.match_history for insert with check (auth.uid()::text = player_id);
