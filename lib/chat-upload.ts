import { supabase } from "./supabase";

export const CHAT_BUCKET = "chat-images";
export const CHAT_FILE_MAX = 2 * 1024 * 1024;
/** Must match allowed_mime_types of the bucket in db/online.sql. */
export const CHAT_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

/** Upload a chat attachment to the user's folder in Storage and return its public URL. */
export async function uploadChatFile(userId: string, blob: Blob, name: string): Promise<string> {
  if (!CHAT_FILE_TYPES.includes(blob.type)) throw new Error("Chỉ gửi được ảnh, PDF, TXT/CSV, ZIP hoặc tệp Office.");
  if (blob.size > CHAT_FILE_MAX) throw new Error("Tệp tối đa 2 MB.");
  const ext = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message)) throw new Error("Server chưa có bucket ảnh chat (chạy db/online.sql).");
    throw new Error(error.message);
  }
  return supabase.storage.from(CHAT_BUCKET).getPublicUrl(path).data.publicUrl;
}
