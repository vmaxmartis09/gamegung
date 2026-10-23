"use client";

// Audio manager specifically for LyLy Narrator Voice in Werewolf game

let currentNarratorAudio: HTMLAudioElement | null = null;

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
};

export function stopNarratorVoice() {
  if (currentNarratorAudio) {
    try {
      currentNarratorAudio.pause();
      currentNarratorAudio.currentTime = 0;
    } catch {}
    currentNarratorAudio = null;
  }
}

export function playNarratorVoice(
  key: keyof typeof NARRATOR_AUDIO_MAP,
  fallbackText?: string,
  onEnded?: () => void
) {
  if (typeof window === "undefined") return;

  const src = NARRATOR_AUDIO_MAP[key];
  if (!src) return;

  stopNarratorVoice();

  const audio = new Audio(src);
  audio.volume = 0.95;
  currentNarratorAudio = audio;

  audio.onended = () => {
    if (currentNarratorAudio === audio) {
      currentNarratorAudio = null;
    }
    onEnded?.();
  };

  audio.onerror = () => {
    console.warn(`[NarratorAudio] Could not play ${src}, falling back to Web Speech TTS`);
    if (fallbackText && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const ut = new SpeechSynthesisUtterance(fallbackText);
      ut.lang = "vi-VN";
      ut.rate = 1.05;
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find((v) => v.lang.includes("vi"));
      if (viVoice) ut.voice = viVoice;
      ut.onend = () => onEnded?.();
      try {
        window.speechSynthesis.speak(ut);
      } catch {}
    }
  };

  audio.play().catch((err) => {
    // Autoplay restrictions or missing file
    console.warn("[NarratorAudio] Audio play failed:", err);
    if (fallbackText && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const ut = new SpeechSynthesisUtterance(fallbackText);
      ut.lang = "vi-VN";
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find((v) => v.lang.includes("vi"));
      if (viVoice) ut.voice = viVoice;
      ut.onend = () => onEnded?.();
      try {
        window.speechSynthesis.speak(ut);
      } catch {}
    }
  });
}
