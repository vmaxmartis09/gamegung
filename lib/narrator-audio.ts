"use client";

// Audio manager specifically for LyLy Narrator Voice in Werewolf game

let currentNarratorAudio: HTMLAudioElement | null = null;

type Clip = { key: string; text?: string; onEnded?: () => void };
const queue: Clip[] = [];
let playing = false;
const idleWaiters: (() => void)[] = [];
let generation = 0;
const CLIP_GAP_MS = 1400;

export const NARRATOR_AUDIO_MAP: Record<string, string> = {
  intro: "/audio/narrator/intro.mp3",
  night_falls: "/audio/narrator/night_falls.mp3",
  cupid: "/audio/narrator/cupid.mp3",
  guard: "/audio/narrator/guard.mp3",
  wolves: "/audio/narrator/wolves.mp3",
  white_wolf: "/audio/narrator/white_wolf.mp3",
  seer: "/audio/narrator/seer.mp3",
  witch: "/audio/narrator/witch.mp3",
  day_break: "/audio/narrator/day_break.mp3",
  no_one_died: "/audio/narrator/no_one_died.mp3",
  someone_died: "/audio/narrator/someone_died.mp3",
  vote_start: "/audio/narrator/vote_start.mp3",
  vote_reveal: "/audio/narrator/vote_reveal.mp3",
  villager_win: "/audio/narrator/villager_win.mp3",
  wolf_win: "/audio/narrator/wolf_win.mp3",
  lovers_win: "/audio/narrator/lovers_win.mp3",
  dl_deal: "/audio/narrator/dl_deal.mp3",
  dl_plus4: "/audio/narrator/dl_plus4.mp3",
  dl_plus2: "/audio/narrator/dl_plus2.mp3",
  dl_skip: "/audio/narrator/dl_skip.mp3",
  dl_reverse: "/audio/narrator/dl_reverse.mp3",
  dl_wild_tech: "/audio/narrator/dl_wild_tech.mp3",
  dl_wild_sales: "/audio/narrator/dl_wild_sales.mp3",
  dl_wild_hr: "/audio/narrator/dl_wild_hr.mp3",
  dl_wild_design: "/audio/narrator/dl_wild_design.mp3",
  dl_chot: "/audio/narrator/dl_chot.mp3",
  dl_out: "/audio/narrator/dl_out.mp3",
  ty_ready: "/audio/narrator/ty_ready.mp3",
  ty_go: "/audio/narrator/ty_go.mp3",
  ty_merge: "/audio/narrator/ty_merge.mp3",
  ty_ko: "/audio/narrator/ty_ko.mp3",
  ty_versus: "/audio/narrator/ty_versus.mp3",
};

function flushIdle() {
  if (playing || queue.length) return;
  idleWaiters.splice(0).forEach((f) => f());
}

export function stopNarratorVoice() {
  generation++;
  queue.length = 0;
  playing = false;
  if (currentNarratorAudio) {
    try {
      currentNarratorAudio.pause();
      currentNarratorAudio.currentTime = 0;
    } catch {}
    currentNarratorAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  flushIdle();
}

/** Quản trò đang đọc (hoặc còn câu chờ đọc). */
export function isNarratorBusy() {
  return playing || queue.length > 0;
}

/** Chạy cb khi quản trò đọc xong hết; chạy ngay nếu đang rảnh. Có timeout an toàn. */
export function whenNarratorIdle(cb: () => void, maxWaitMs = 25000) {
  if (!isNarratorBusy()) return cb();
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    cb();
  };
  idleWaiters.push(run);
  setTimeout(run, maxWaitMs);
}

function playNext() {
  if (playing) return;
  const clip = queue.shift();
  if (!clip) return flushIdle();
  playing = true;
  const gen = generation;
  let finished = false;
  const finish = () => {
    if (finished || gen !== generation) return;
    finished = true;
    currentNarratorAudio = null;
    clip.onEnded?.();
    // nghỉ một nhịp giữa các câu cho chậm rãi; trong lúc nghỉ vẫn tính là "bận"
    setTimeout(() => {
      if (gen !== generation) return;
      playing = false;
      playNext();
    }, CLIP_GAP_MS);
  };
  const speakFallback = () => {
    if (clip.text && typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const ut = new SpeechSynthesisUtterance(clip.text);
        ut.lang = "vi-VN";
        ut.rate = 1.05;
        const viVoice = window.speechSynthesis.getVoices().find((v) => v.lang.includes("vi"));
        if (viVoice) ut.voice = viVoice;
        ut.onend = finish;
        ut.onerror = finish;
        window.speechSynthesis.speak(ut);
        return;
      } catch {}
    }
    finish();
  };

  const src = NARRATOR_AUDIO_MAP[clip.key];
  if (!src) return speakFallback();
  const audio = new Audio(src);
  audio.volume = 0.95;
  currentNarratorAudio = audio;
  audio.onended = finish;
  audio.onerror = speakFallback;
  audio.play().catch(speakFallback);
}

/** Xếp câu vào hàng đợi — không bao giờ cắt ngang câu đang đọc. */
export function playNarratorVoice(key: keyof typeof NARRATOR_AUDIO_MAP, fallbackText?: string, onEnded?: () => void) {
  if (typeof window === "undefined") return;
  queue.push({ key, text: fallbackText, onEnded });
  playNext();
}
