"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WerewolfVoiceState {
  isMicOn: boolean;
  volume: number; // 0..100
  isSpeaking: boolean;
  transcript: string;
  toggleMic: () => Promise<void>;
  error: string | null;
}

export function useWerewolfVoice(onSpeechRecognized?: (text: string) => void): WerewolfVoiceState {
  const [isMicOn, setIsMicOn] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  const stopAudio = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsMicOn(false);
    setVolume(0);
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const toggleMic = async () => {
    if (isMicOn) {
      stopAudio();
      return;
    }

    setError(null);
    try {
      if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Trình duyệt không hỗ trợ truy cập Microphone.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext; // eslint-disable-line @typescript-eslint/no-explicit-any
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Volume detection loop
      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));

        setVolume(normalized);
        setIsSpeaking(normalized > 18);

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };
      animFrameRef.current = requestAnimationFrame(checkVolume);

      // Speech Recognition in Vietnamese
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (SpeechRec) {
        const recognition = new SpeechRec();
        recognition.lang = "vi-VN";
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript.trim()) {
            setTranscript(finalTranscript.trim());
            if (onSpeechRecognized) {
              onSpeechRecognized(finalTranscript.trim());
            }
          }
        };

        recognition.onerror = () => {};
        recognition.onend = () => {
          if (streamRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch {}
      }

      setIsMicOn(true);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setError(err?.message || "Không thể bật microphone");
      stopAudio();
    }
  };

  return {
    isMicOn,
    volume,
    isSpeaking,
    transcript,
    toggleMic,
    error,
  };
}

export function WerewolfMicButton({
  voice,
  className,
}: {
  voice: WerewolfVoiceState;
  className?: string;
}) {
  return (
    <div className={cn("relative inline-flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={voice.toggleMic}
        className={cn(
          "flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition-all shadow-md active:scale-95",
          voice.isMicOn
            ? "bg-lime-400 text-black border-2 border-lime-300 ring-2 ring-lime-400/40"
            : "bg-white/10 text-white hover:bg-white/15 border border-white/10"
        )}
        title={voice.isMicOn ? "Tắt Microphone" : "Bật Microphone nói chuyện"}
      >
        {voice.isMicOn ? (
          <>
            <Mic className="size-4 text-black animate-pulse" />
            <span>Mic Đang Bật</span>
            {/* Live Volume indicator bars */}
            <div className="flex items-end gap-0.5 h-3 ml-1">
              <span
                className="w-1 bg-black rounded-full transition-all duration-75"
                style={{ height: `${Math.max(20, voice.volume * 0.8)}%` }}
              />
              <span
                className="w-1 bg-black rounded-full transition-all duration-75"
                style={{ height: `${Math.max(30, voice.volume * 1.2)}%` }}
              />
              <span
                className="w-1 bg-black rounded-full transition-all duration-75"
                style={{ height: `${Math.max(20, voice.volume * 0.9)}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <MicOff className="size-4 text-ink-300" />
            <span>Bật Mic Nói</span>
          </>
        )}
      </button>

      {voice.error && (
        <span className="text-[11px] text-pop-red absolute -bottom-5 left-0 whitespace-nowrap">
          {voice.error}
        </span>
      )}
    </div>
  );
}
