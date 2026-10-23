import { BlackHoleLoading } from "@/components/auth/auth-gate";

export default function NotFound() {
  return <BlackHoleLoading message="404 · Không tìm thấy trang" subMessage="Đang đưa bạn về trang chủ" homeCountdown={{ startAfterMs: 0, seconds: 10 }} />;
}
