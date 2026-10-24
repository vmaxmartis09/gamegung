import { CaroGame } from "@/components/games/caro-game";

export const metadata = {
  title: "Cờ Caro | Office Arena",
  description: "Cờ Caro (Gomoku) 15x15, 5 quân liền thắng, đấu AI hoặc 2 người",
};

export default function CaroPage() {
  return <CaroGame />;
}
