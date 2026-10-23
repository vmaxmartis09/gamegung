// Tạo N tài khoản test cho Office Arena bằng Supabase Admin API.
//
// Chạy (PowerShell):
//   $env:SUPABASE_URL="https://<project>.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<service role key>"   # Supabase → Project Settings → API (KHÔNG commit, KHÔNG đưa vào NEXT_PUBLIC_*)
//   node scripts/create-test-accounts.mjs [số lượng, mặc định 5]
//
// Mật khẩu được sinh ngẫu nhiên và chỉ ghi vào scripts/test-accounts.local.json (đã gitignore).
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws"; // Node < 22 không có WebSocket gốc
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || key.includes("<")) {
  console.error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY (đừng để nguyên chữ <service role key>).");
  process.exit(1);
}

const count = Math.max(1, Math.min(20, Number(process.argv[2]) || 5));
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
});
const NAMES = ["Linh QA", "Tuấn Dev", "Minh Sale", "Trang Design", "Hùng Ops", "Mai PM", "Quân BA", "Vy Content"];

const accounts = [];
for (let i = 1; i <= count; i++) {
  const email = `test${i}@office-arena.test`;
  const password = randomBytes(9).toString("base64url");
  const username = NAMES[(i - 1) % NAMES.length];
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) {
    console.error(`✗ ${email}: ${error.message}`);
    continue;
  }
  accounts.push({ email, password, username, id: data.user.id });
  console.log(`✓ ${email}`);
}

if (accounts.length) {
  writeFileSync(new URL("./test-accounts.local.json", import.meta.url), JSON.stringify(accounts, null, 2));
  console.log(`\nĐã lưu ${accounts.length} tài khoản vào scripts/test-accounts.local.json`);
}
