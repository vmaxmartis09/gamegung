import { supabase, isSupabaseConfigured } from "./supabase";

export const AVATAR_BUCKET = "avatars";
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const OUTPUT_SIZE = 256;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const AVATAR_ACCEPT = ACCEPT.join(",");

const isAccountId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Cắt vuông giữa ảnh và thu về 256×256 webp để file nhẹ (thường < 30KB). */
async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.86));
  if (!blob) throw new Error("Không nén được ảnh.");
  return blob;
}

/** Upload ảnh đại diện lên Supabase Storage và trả về URL công khai. */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Chưa cấu hình Supabase.");
  if (!isAccountId(userId)) throw new Error("Cần đăng nhập tài khoản để tải ảnh lên.");
  if (!ACCEPT.includes(file.type)) throw new Error("Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("Ảnh quá lớn (tối đa 5MB).");

  const blob = await toSquareWebp(file);
  // Tên file có timestamp để tránh cache CDN cũ khi đổi ảnh.
  const path = `${userId}/${Date.now()}.webp`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message)) throw new Error("Chưa tạo bucket “avatars” trên Supabase (chạy SQL trong lib/supabase-schema.sql).");
    if (/row-level security|not authorized|permission/i.test(error.message)) throw new Error("Không có quyền tải lên. Hãy đăng nhập lại.");
    throw new Error(error.message);
  }
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  void removeOldAvatars(userId, path);
  return data.publicUrl;
}

/** Dọn các ảnh cũ của chính mình, chỉ giữ ảnh vừa tải. Lỗi thì bỏ qua. */
async function removeOldAvatars(userId: string, keepPath: string) {
  try {
    const { data } = await supabase.storage.from(AVATAR_BUCKET).list(userId, { limit: 50 });
    const stale = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keepPath);
    if (stale.length) await supabase.storage.from(AVATAR_BUCKET).remove(stale);
  } catch {
    /* không quan trọng */
  }
}
