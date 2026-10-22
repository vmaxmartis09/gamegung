import { DeadlineGame } from "@/components/games/deadline-game";

export const metadata = {
  title: "Deadline Rush | Office Arena",
  description: "Game bài đẩy việc 2–4 người: chồng phạt +2/+4, đánh nhiều lá cùng số, hô CHỐT khi còn 1 lá.",
};

export default function DeadlineRushPage() {
  return <DeadlineGame />;
}
