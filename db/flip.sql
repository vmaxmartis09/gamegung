-- Lật Thẻ Đối Kháng online (kèo cược bạn bè): cho phép game 'flip' trong bảng matches / lịch sử / hàng chờ.
-- Mỗi nước đi lưu một lượt đầy đủ của một người (danh sách cặp thẻ [a, b] đã lật); bộ bài sinh từ id bàn ở client.
-- Không có đồng hồ: client mở trận với base_ms rất lớn nên không bao giờ hết giờ.
alter table public.matches drop constraint if exists matches_game_check;
alter table public.matches add constraint matches_game_check check (game in ('chess', 'xiangqi', 'caro', 'flip'));
alter table public.match_history drop constraint if exists match_history_game_type_check;
alter table public.match_history add constraint match_history_game_type_check
  check (game_type in ('chess', 'xiangqi', 'werewolf', 'uno', 'arcade', 'typing', 'caro', 'flip'));
alter table public.matchmaking_queue drop constraint if exists matchmaking_queue_game_type_check;
alter table public.matchmaking_queue add constraint matchmaking_queue_game_type_check
  check (game_type in ('chess', 'xiangqi', 'werewolf', 'uno', 'arcade', 'typing', 'caro', 'flip'));
