import { createClient } from "@supabase/supabase-js";

if (typeof window === "undefined" && typeof global !== "undefined") {
  try {
    const WebSocket = require("ws");
    if (!(global as unknown as { WebSocket: unknown }).WebSocket) {
      (global as unknown as { WebSocket: unknown }).WebSocket = WebSocket;
    }
  } catch (e) {
    // ws not available or already defined
  }
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://rzsihfzvefycwamnkizr.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_K6kMv4RBwzvmfaM6v8Ytsg_f9OJ9G-M";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 15,
    },
  },
});
