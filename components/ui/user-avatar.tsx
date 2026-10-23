"use client";

import { memo } from "react";
import { KokonutFace } from "@/components/ui/kokonut-avatar";
import { cn } from "@/lib/utils";

export type PresenceStatus = "online" | "away" | "in-game" | "busy" | "offline";

export const STATUS_META: Record<PresenceStatus, { label: string; dot: string; text: string; ring: string }> = {
  online: { label: "Online", dot: "bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]", text: "text-white", ring: "ring-white/40" },
  "in-game": { label: "Đang chơi", dot: "bg-neutral-300", text: "text-neutral-200", ring: "ring-white/30" },
  away: { label: "Away", dot: "bg-neutral-500", text: "text-neutral-400", ring: "ring-neutral-500/40" },
  busy: { label: "Bận", dot: "bg-neutral-400 ring-1 ring-white/50", text: "text-neutral-300", ring: "ring-neutral-400/40" },
  offline: { label: "Offline", dot: "bg-neutral-700", text: "text-neutral-500", ring: "ring-neutral-700/40" },
};

export const KOKONUT_PREFIX = "kokonut:";

export function kokonutAvatar(seed: string) {
  return `${KOKONUT_PREFIX}${seed}`;
}

/** Bots and legacy avatars get a deterministic Kokonut face, so nothing is fetched over the network. */
export function avatarSeedFrom(src: string | undefined, name: string) {
  if (src?.startsWith(KOKONUT_PREFIX)) return src.slice(KOKONUT_PREFIX.length);
  if (src && src.includes("dicebear.com")) {
    const m = src.match(/seed=([^&]+)/);
    return `${decodeURIComponent(m?.[1] ?? name).toLowerCase()}:0`;
  }
  return `${name.trim().toLowerCase()}:0`;
}

interface UserAvatarProps {
  src?: string;
  name: string;
  className?: string;
  status?: PresenceStatus;
  /** Tailwind classes for the status dot size/border. */
  dotClassName?: string;
  rounded?: "full" | "xl" | "2xl";
}

export const UserAvatar = memo(function UserAvatar({
  src,
  name,
  className,
  status,
  dotClassName,
  rounded = "full",
}: UserAvatarProps) {
  const isImage = !!src && !src.startsWith(KOKONUT_PREFIX) && !src.includes("dicebear.com");
  const radius = rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : "rounded-2xl";
  return (
    <span className={cn("relative inline-block shrink-0", className ?? "size-9")}>
      <span className={cn("block h-full w-full overflow-hidden bg-ink-700 ring-1 ring-black/20", radius)}>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <KokonutFace seed={avatarSeedFrom(src, name)} title={name} />
        )}
      </span>
      {status && (
        <span
          aria-label={STATUS_META[status].label}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 block size-3 rounded-full border-2 border-ink-900",
            STATUS_META[status].dot,
            dotClassName
          )}
        />
      )}
    </span>
  );
});
