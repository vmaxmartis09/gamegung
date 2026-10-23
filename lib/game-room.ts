"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./store";

/**
 * Phòng realtime riêng cho từng game: chat nháp + gọi thoại như call.
 *  - Chat, trạng thái mic và tín hiệu WebRTC chạy qua một kênh Supabase Realtime `game-room:<game>`.
 *  - Thoại là WebRTC mesh (mỗi người nối với mọi người) — hợp với phòng nhỏ (≤ 8–10 người).
 *  - Mỗi kết nối có sẵn một transceiver audio sendrecv; bật/tắt mic chỉ `replaceTrack`, không cần đàm phán lại.
 *  - Chỉ dùng STUN công khai; mạng NAT đối xứng có thể cần thêm TURN.
 */

export interface RoomMember {
  id: string;
  name: string;
  avatar: string;
  mic: boolean;
}

export interface RoomMessage {
  id: string;
  from: string;
  name: string;
  avatar: string;
  text: string;
  ts: number;
}

type Signal = { from: string; to: string; kind: "offer" | "answer" | "ice"; data: unknown };

const ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };
const MAX_MESSAGES = 80;

interface Peer {
  pc: RTCPeerConnection;
  pending: RTCIceCandidateInit[];
  audio: HTMLAudioElement;
  analyser?: AnalyserNode;
  source?: MediaStreamAudioSourceNode;
}

export function useGameRoom(game: string) {
  const me = useAppStore(useShallow((s) => ({ id: s.currentUser.id, name: s.currentUser.username, avatar: s.currentUser.avatar })));

  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [deafened, setDeafenedState] = useState(false);
  const [speaking, setSpeaking] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const peers = useRef(new Map<string, Peer>());
  const localStream = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const localAnalyser = useRef<AnalyserNode | null>(null);
  const micRef = useRef(false);
  const deafRef = useRef(false);
  const meRef = useRef(me);
  meRef.current = me;

  const track = useCallback((mic: boolean) => {
    const m = meRef.current;
    channelRef.current?.track({ id: m.id, name: m.name, avatar: m.avatar, mic }).catch(() => {});
  }, []);

  const audioCtx = useCallback(() => {
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  const sendSignal = useCallback((to: string, kind: Signal["kind"], data: unknown) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload: { from: meRef.current.id, to, kind, data } satisfies Signal }).catch(() => {});
  }, []);

  const closePeer = useCallback((id: string) => {
    const p = peers.current.get(id);
    if (!p) return;
    p.pc.close();
    p.audio.srcObject = null;
    p.source?.disconnect();
    peers.current.delete(id);
  }, []);

  const makePeer = useCallback(
    (id: string, initiator: boolean): Peer => {
      const pc = new RTCPeerConnection(ICE);
      const audio = new Audio();
      audio.autoplay = true;
      audio.muted = deafRef.current;
      const peer: Peer = { pc, pending: [], audio };
      peers.current.set(id, peer);

      if (initiator) pc.addTransceiver("audio", { direction: "sendrecv" });
      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(id, "ice", e.candidate.toJSON());
      };
      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        audio.srcObject = stream;
        audio.play().catch(() => {});
        try {
          const ctx = audioCtx();
          peer.source?.disconnect();
          peer.source = ctx.createMediaStreamSource(stream);
          peer.analyser = ctx.createAnalyser();
          peer.analyser.fftSize = 512;
          peer.source.connect(peer.analyser);
        } catch {
          /* không đo được mức nói */
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") closePeer(id);
      };
      // mic đang bật sẵn → gắn track ngay khi có sender
      const attach = () => {
        const track = localStream.current?.getAudioTracks()[0];
        if (track) pc.getSenders().find((s) => s.track === null || s.track?.kind === "audio")?.replaceTrack(track).catch(() => {});
      };
      if (initiator) attach();
      return peer;
    },
    [audioCtx, closePeer, sendSignal],
  );

  const handleSignal = useCallback(
    async (sig: Signal) => {
      if (sig.to !== meRef.current.id) return;
      try {
        if (sig.kind === "offer") {
          closePeer(sig.from);
          const peer = makePeer(sig.from, false);
          await peer.pc.setRemoteDescription(sig.data as RTCSessionDescriptionInit);
          const tr = peer.pc.getTransceivers()[0];
          if (tr) tr.direction = "sendrecv";
          const track = localStream.current?.getAudioTracks()[0];
          if (track && tr) await tr.sender.replaceTrack(track);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          sendSignal(sig.from, "answer", answer);
          for (const c of peer.pending.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {});
        } else if (sig.kind === "answer") {
          const peer = peers.current.get(sig.from);
          if (!peer) return;
          await peer.pc.setRemoteDescription(sig.data as RTCSessionDescriptionInit);
          for (const c of peer.pending.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {});
        } else {
          const peer = peers.current.get(sig.from);
          if (!peer) return;
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(sig.data as RTCIceCandidateInit).catch(() => {});
          else peer.pending.push(sig.data as RTCIceCandidateInit);
        }
      } catch {
        closePeer(sig.from);
      }
    },
    [closePeer, makePeer, sendSignal],
  );

  // tham gia kênh của game
  useEffect(() => {
    if (!isSupabaseConfigured || !me.id) return;
    setMessages([]);
    setMembers([]);
    setConnected(false);
    const ch = supabase.channel(`game-room:${game}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
    channelRef.current = ch;

    const syncMembers = () => {
      const state = ch.presenceState() as Record<string, RoomMember[]>;
      const list = Object.values(state)
        .map((arr) => arr[arr.length - 1])
        .filter(Boolean);
      setMembers(list);
      const ids = new Set(list.map((m) => m.id));
      // người mới: bên có id nhỏ hơn chủ động gọi
      for (const m of list) {
        if (m.id === meRef.current.id || peers.current.has(m.id)) continue;
        if (meRef.current.id < m.id) {
          const peer = makePeer(m.id, true);
          peer.pc
            .createOffer()
            .then((offer) => peer.pc.setLocalDescription(offer).then(() => sendSignal(m.id, "offer", offer)))
            .catch(() => closePeer(m.id));
        }
      }
      for (const id of [...peers.current.keys()]) if (!ids.has(id)) closePeer(id);
    };

    ch.on("presence", { event: "sync" }, syncMembers)
      .on("broadcast", { event: "chat" }, ({ payload }) => setMessages((prev) => [...prev, payload as RoomMessage].slice(-MAX_MESSAGES)))
      .on("broadcast", { event: "signal" }, ({ payload }) => void handleSignal(payload as Signal))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          track(micRef.current);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnected(false);
      });

    return () => {
      for (const id of [...peers.current.keys()]) closePeer(id);
      localStream.current?.getTracks().forEach((t) => t.stop());
      localStream.current = null;
      localAnalyser.current = null;
      micRef.current = false;
      setMicOn(false);
      setSpeaking([]);
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, me.id]);

  // đồng bộ tên/avatar mới lên presence
  useEffect(() => {
    if (connected) track(micRef.current);
  }, [me.name, me.avatar, connected, track]);

  // đo ai đang nói
  useEffect(() => {
    const buf = new Uint8Array(256);
    const level = (a?: AnalyserNode | null) => {
      if (!a) return 0;
      a.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / buf.length);
    };
    const t = setInterval(() => {
      const next: string[] = [];
      if (micRef.current && level(localAnalyser.current) > 0.04) next.push(meRef.current.id);
      peers.current.forEach((p, id) => {
        if (level(p.analyser) > 0.03) next.push(id);
      });
      setSpeaking((prev) => (prev.length === next.length && prev.every((x) => next.includes(x)) ? prev : next));
    }, 140);
    return () => clearInterval(t);
  }, []);

  const toggleMic = useCallback(async () => {
    setError(null);
    if (micRef.current) {
      localStream.current?.getTracks().forEach((t) => t.stop());
      localStream.current = null;
      localAnalyser.current = null;
      peers.current.forEach((p) => p.pc.getSenders().forEach((s) => s.replaceTrack(null).catch(() => {})));
      micRef.current = false;
      setMicOn(false);
      track(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt không hỗ trợ micro (cần HTTPS hoặc localhost).");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      localStream.current = stream;
      const track0 = stream.getAudioTracks()[0];
      peers.current.forEach((p) => p.pc.getSenders().forEach((s) => s.replaceTrack(track0).catch(() => {})));
      const ctx = audioCtx();
      localAnalyser.current = ctx.createAnalyser();
      localAnalyser.current.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(localAnalyser.current);
      micRef.current = true;
      setMicOn(true);
      track(true);
    } catch (e) {
      const name = (e as DOMException).name;
      setError(name === "NotAllowedError" ? "Bạn đã chặn quyền micro." : name === "NotFoundError" ? "Không tìm thấy micro." : "Không bật được micro.");
    }
  }, [audioCtx, track]);

  const setDeafened = useCallback((v: boolean) => {
    deafRef.current = v;
    setDeafenedState(v);
    peers.current.forEach((p) => {
      p.audio.muted = v;
    });
  }, []);

  const send = useCallback((text: string) => {
    const t = text.trim().slice(0, 300);
    if (!t) return;
    const m = meRef.current;
    const msg: RoomMessage = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, from: m.id, name: m.name, avatar: m.avatar, text: t, ts: Date.now() };
    setMessages((prev) => [...prev, msg].slice(-MAX_MESSAGES));
    channelRef.current?.send({ type: "broadcast", event: "chat", payload: msg }).catch(() => {});
  }, []);

  return { me, members, messages, send, micOn, toggleMic, deafened, setDeafened, speaking, error, connected };
}
