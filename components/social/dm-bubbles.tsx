"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { usePresenceStore } from "@/lib/presence";
import { dmOtherId, isDmChannel } from "@/lib/chat";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Tooltip } from "@/components/ui/tooltip";

const MAX_BUBBLES = 4;

/**
 * Floating "chat heads": one bubble per private conversation, with the peer's online dot and
 * unread count. Clicking a bubble opens that thread in the drawer.
 */
export function DmBubbles() {
  const { messages, dmPeers, unread, myId, activeChannel, chatOpen, collapsed } = useAppStore(
    useShallow((s) => ({
      messages: s.messages,
      dmPeers: s.dmPeers,
      unread: s.unreadCounts,
      myId: s.currentUser.id,
      activeChannel: s.activeChannel,
      chatOpen: s.isChatOpen,
      collapsed: s.isChatCollapsed,
    }))
  );
  const openDm = useAppStore((s) => s.openDm);
  const peers = usePresenceStore((s) => s.peers);

  const threads = useMemo(
    () =>
      Object.entries(messages)
        .filter(([id, list]) => isDmChannel(id) && list.length > 0 && dmPeers[id])
        .map(([id, list]) => ({ id, last: list[list.length - 1].timestamp }))
        .sort((a, b) => b.last - a.last),
    [messages, dmPeers]
  );

  // With the drawer open, the thread on screen needs no bubble.
  const visible = threads.filter((t) => collapsed || t.id !== activeChannel).slice(0, MAX_BUBBLES);
  if (!chatOpen || visible.length === 0) return null;

  return (
    <div
      className={
        collapsed
          ? "fixed bottom-24 right-4 z-50 flex flex-col-reverse items-center gap-3"
          : "fixed bottom-4 right-3 z-40 hidden flex-col-reverse items-center gap-3 sm:flex sm:right-[404px] xl:right-[444px]"
      }
    >
      <AnimatePresence initial={false}>
        {visible.map((t) => {
          const peer = dmPeers[t.id];
          const otherId = dmOtherId(t.id, myId);
          const status = peers[otherId]?.status ?? "offline";
          const count = unread[t.id] || 0;
          return (
            <motion.div key={t.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
              <Tooltip content={peer.username} side="left">
                <button
                  type="button"
                  onClick={() => openDm(peer)}
                  aria-label={count > 0 ? `Mở chat với ${peer.username}, ${count} tin chưa đọc` : `Mở chat với ${peer.username}`}
                  className="relative grid size-12 place-items-center rounded-full border border-white/15 bg-ink-900 shadow-lift transition-transform hover:scale-105 active:scale-95"
                >
                  <UserAvatar src={peer.avatar} name={peer.username} status={status} className="size-11" />
                  {count > 0 && (
                    <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-xs font-semibold leading-5 text-white">{count > 99 ? "99+" : count}</span>
                  )}
                </button>
              </Tooltip>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
