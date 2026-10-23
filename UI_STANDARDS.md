# UI standards (apply to every screen)

Read before adding or changing UI. Verified with `.claude/skills/taste-skill` (app-screen rules).

## One function, one control, one place
- A function has exactly one control on a surface. Never add a second button/link that does the same thing
  (e.g. modal X **and** a footer "Đóng"/"Đã hiểu"; a sound toggle in both game header and chat drawer; a
  "Chat" button while the chat drawer is already open).
- Modals: dismiss = header X (plus Esc/backdrop). Footer holds only distinct actions (confirm, secondary task).
- Global destinations live in one hub: ranking / character / matchmaking / wallet / profile / sign-out → chat drawer.
  Game screens: back, rules, chat, sound → `GameHeader`. Don't repeat them in page content.
- A whole-card link must not also render a look-alike button (arrow). Inner actions are real, distinct buttons.

## Type
- Minimum text size 12px (`text-xs`). Secondary copy 14px (`text-sm`). No `text-[9|10|11px]`.
- Display: `font-display`; one focal heading per screen (≥ `text-4xl` on desktop landing views).

## Controls
- Icon-only buttons use `.icon-btn` (40px, 44px on touch) with `aria-label`. Text buttons use `Button`/`.btn-*`.
- Destructive actions (discard, delete, sign-out of progress) need a confirm step; never a single misclick.
- Hover is enhancement only: nothing essential (info, action) may exist only on hover.

## Motion
- `MotionConfig reducedMotion="user"` wraps the app; CSS honours `prefers-reduced-motion`.
- At most one attention-grabbing effect per screen. No looping 3D/rotating text on primary views.

## Layout & colour
- Pages scroll naturally; don't pin content to `100dvh` unless it is a game board.
- Colours come from tokens (`ink-*`, `accent`, `success`, `danger`) – no new raw `#hex`.
- New modals use `components/ui/modal.tsx`; new buttons use `components/ui/button.tsx`.
