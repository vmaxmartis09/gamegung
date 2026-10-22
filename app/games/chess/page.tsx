import { ChessGame } from "@/components/games/chess-game";

export const metadata = {
  title: "Cờ Vua Văn Phòng | Office Arena",
  description: "Trò chơi cờ vua FIDE chuẩn quốc tế phong cách đen trắng sang trọng cho dân văn phòng",
};

export default function ChessPage() {
  return <ChessGame />;
}
