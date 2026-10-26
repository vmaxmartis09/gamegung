"use client";

import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAppStore, type Friend } from "@/lib/store";
import { usePresenceStore } from "@/lib/presence";
import { isAccountId } from "@/lib/supabase-game";

/** Người tìm thấy: id tài khoản, tên, avatar. */
export type FoundUser = { id: string; username: string; avatar: string };

function toFriend(p: { id: string; username: string | null; avatar: string | null; title?: string | null; lua?: number | null; elo_chess?: number | null; elo_xiangqi?: number | null; elo_werewolf?: number | null }): Friend {
  const online = !!usePresenceStore.getState().peers[p.id];
  return {
    id: p.id,
    username: p.username || "Đồng nghiệp",
    avatar: p.avatar || "",
    title: p.title || "Chiến Hữu Văn Phòng",
    status: online ? "online" : "offline",
    unreadCount: 0,
    lua: p.lua ?? 0,
    eloChess: p.elo_chess ?? 1200,
    eloXiangqi: p.elo_xiangqi ?? 1200,
    eloWerewolf: p.elo_werewolf ?? 1200,
    equippedBadges: [],
  } as Friend;
}

/** Tải danh sách bạn bè thật từ server (thay danh sách cũ trên máy). */
export async function loadFriends() {
  const me = useAppStore.getState().currentUser.id;
  if (!isSupabaseConfigured || !isAccountId(me)) return;
  const { data, error } = await supabase.from("oa_friends").select("friend_id").eq("user_id", me);
  if (error) {
    console.warn("[friends] load:", error.message);
    return;
  }
  const ids = (data ?? []).map((r: { friend_id: string }) => r.friend_id);
  if (!ids.length) return useAppStore.setState({ friends: [] });
  const { data: profiles } = await supabase.from("oa_profiles").select("id, username, avatar, title, lua, elo_chess, elo_xiangqi, elo_werewolf").in("id", ids);
  useAppStore.setState({ friends: (profiles ?? []).map(toFriend) });
}

/** Tìm người theo tên (không gồm mình). */
export async function searchUsers(q: string): Promise<FoundUser[]> {
  const term = q.trim().replace(/[%_,()]/g, "");
  if (term.length < 2 || !isSupabaseConfigured) return [];
  const me = useAppStore.getState().currentUser.id;
  const { data, error } = await supabase.from("oa_profiles").select("id, username, avatar").ilike("username", `%${term}%`).neq("id", me).limit(8);
  if (error) {
    console.warn("[friends] search:", error.message);
    return [];
  }
  return (data ?? []).map((p: { id: string; username: string | null; avatar: string | null }) => ({ id: p.id, username: p.username || "Đồng nghiệp", avatar: p.avatar || "" }));
}

export function isFriend(id: string) {
  return useAppStore.getState().friends.some((f) => f.id === id);
}

/** Kết bạn ngay (hai chiều). Trả về lỗi hoặc null. */
export async function addFriend(u: FoundUser): Promise<string | null> {
  if (!isAccountId(u.id)) return "Chỉ kết bạn được với tài khoản đã đăng ký.";
  if (isFriend(u.id)) return null;
  const { data, error } = await supabase.rpc("friend_add", { p_friend: u.id });
  if (error) return /could not find the function|schema cache/i.test(error.message) ? "Server chưa cài bạn bè (chạy db/friends.sql)." : error.message;
  if (!data) return "Không kết bạn được.";
  useAppStore.setState((s) => ({ friends: [toFriend({ id: u.id, username: u.username, avatar: u.avatar }), ...s.friends.filter((f) => f.id !== u.id)] }));
  return null;
}

export async function removeFriend(id: string) {
  await supabase.rpc("friend_remove", { p_friend: id });
  useAppStore.setState((s) => ({ friends: s.friends.filter((f) => f.id !== id) }));
}

/** Đồng bộ danh sách bạn: tải khi đăng nhập, cập nhật ngay khi có người kết bạn / huỷ với mình. */
export function useFriendsSync() {
  const me = useAppStore((s) => s.currentUser.id);
  useEffect(() => {
    if (!isSupabaseConfigured || !isAccountId(me)) return;
    void loadFriends();
    const ch = supabase
      .channel("friends-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "oa_friends" }, () => void loadFriends())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [me]);
}
