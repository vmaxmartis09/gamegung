// Web Audio API procedural sound synthesizer (Zero external asset dependencies)

class SoundPlayer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** Helper: Generates realistic tactile acoustic clicks (wood, cards, mechanical switches) */
  private playFilteredNoise(duration: number, freq: number, q: number, gainVal: number, delay = 0) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime + delay;
      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(freq, now);
      filter.Q.setValueAtTime(q, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);
    } catch (e) {
      // Audio fallback
    }
  }

  /* -------------------------------------------------------------------------
   * CỜ VUA (CHESS) SOUND SET
   * Authentic wooden pieces on solid wooden tournament board
   * ------------------------------------------------------------------------- */

  /** Chess piece moving smoothly onto felt/wood */
  playChessMove() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Felt/wood friction click
    this.playFilteredNoise(0.045, 1200, 3.5, 0.16);

    // 2. Solid wood body resonance thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.08);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /** Chess piece capture: piece striking another piece then settling down */
  playChessCapture() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // First sharp collision crack
    this.playFilteredNoise(0.05, 1800, 4.0, 0.28);
    // Second settling thud 35ms later
    this.playFilteredNoise(0.06, 900, 2.5, 0.22, 0.035);

    // Deep wood resonance
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.14);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /** Chess check: sharp alert chime with subtle wood tap */
  playChessCheck() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    this.playFilteredNoise(0.04, 1500, 3, 0.15);

    // High warning interval (A5 + D6)
    [880, 1174.66].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  /** Chess castle: two rhythmic wooden taps (King then Rook) */
  playChessCastle() {
    this.playChessMove();
    setTimeout(() => this.playChessMove(), 110);
  }

  /** Chess promotion: royal fanfare when pawn becomes Queen */
  playChessPromotion() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.2, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.35);
    });
  }

  /* -------------------------------------------------------------------------
   * CỜ TƯỚNG (XIANGQI) SOUND SET
   * Traditional heavy round wooden puck clack ("cạch!"), crisp and resonant
   * ------------------------------------------------------------------------- */

  /** Xiangqi puck placement: heavy, crisp wooden puck slap on thick board ("Cạch!") */
  playXiangqiMove() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Sharp high wood crack impulse
    this.playFilteredNoise(0.06, 2200, 5.0, 0.38);

    // 2. Thick wooden round disc body resonance
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Xiangqi piece capture: loud piece-on-piece knock with secondary board slap */
  playXiangqiCapture() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Violent wooden piece collision crack
    this.playFilteredNoise(0.07, 2600, 4.5, 0.45);
    this.playFilteredNoise(0.08, 1100, 3.0, 0.35, 0.025);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.16);

    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Xiangqi check ("Chiếu Tướng!"): dramatic traditional brass/wood gong strike */
  playXiangqiCheck() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Initial wood impact
    this.playXiangqiMove();

    // Resonant Eastern gong harmonics
    const gongFreqs = [220, 330, 440, 660];
    gongFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now + 0.02);
      gain.gain.setValueAtTime(0.25 / (idx + 1), now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.02);
      osc.stop(now + 0.6);
    });
  }

  /* -------------------------------------------------------------------------
   * MA SÓI (WEREWOLF) SOUND SET
   * Atmospheric, mysterious, spooky, and dramatic village roleplay sounds
   * ------------------------------------------------------------------------- */

  /** Night falls: deep dark bell chime with ominous ambient sub-drone */
  playWerewolfNight() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Dark bell fundamental (C3 + discordant Eb3)
    [130.81, 155.56, 261.63].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 0.98, now + 1.8);

      gain.gain.setValueAtTime(0.22 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.8);
    });

    // Sub-bass drone
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = "sine";
    drone.frequency.setValueAtTime(65.4, now); // C2
    droneGain.gain.setValueAtTime(0.18, now);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

    drone.connect(droneGain);
    droneGain.connect(ctx.destination);
    drone.start(now);
    drone.stop(now + 2.2);
  }

  /** Wolf howl: procedural haunting werewolf howling glide */
  playWerewolfWolfHowl() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Howl frequency envelope: rise from 280Hz -> 540Hz -> peak at 580Hz -> mournful drop to 230Hz
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.4);
    osc.frequency.linearRampToValueAtTime(580, now + 0.7);
    osc.frequency.exponentialRampToValueAtTime(230, now + 1.6);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.35);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

    // Subtle pitch vibrato (LFO)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(5.5, now);
    lfoGain.gain.setValueAtTime(14, now);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    osc.connect(gain);
    gain.connect(ctx.destination);

    lfo.start(now + 0.2);
    lfo.stop(now + 1.6);
    osc.start(now);
    osc.stop(now + 1.6);
  }

  /** Dawn / Day arrives: bright, reassuring sunrise bell chime */
  playWerewolfDawn() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.16, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.7);
    });
  }

  /** Vote tick: intense heartbeat thump during trial voting */
  playWerewolfVote() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Double thump (lub-dub heartbeat)
    [0, 0.11].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(85, now + delay);
      osc.frequency.exponentialRampToValueAtTime(42, now + delay + 0.08);

      gain.gain.setValueAtTime(0.28, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.08);
    });
  }

  /** Execution: heavy hanging gavel doom strike when player is voted out */
  playWerewolfExecution() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Heavy wooden block slam
    this.playFilteredNoise(0.12, 600, 2.0, 0.45);

    // Deep doom drop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.5);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** Night death / Wolf bite slash: dark ominous sting */
  playWerewolfDeath() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Discordant shock chord (F#3 + C4)
    [185, 261.63, 370].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    });
  }

  /** Seer: mystical sparkling crystal ball vision */
  playWerewolfSeer() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sparkleNotes = [880, 1046.5, 1318.51, 1567.98, 1760, 2093];
    sparkleNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);
      gain.gain.setValueAtTime(0.14, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.35);
    });
  }

  /** Witch: magical bubbling potion */
  playWerewolfWitch() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Fast bubbling flutter
    const bubblePitches = [340, 480, 390, 520, 440, 600];
    bubblePitches.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + idx * 0.04 + 0.05);

      gain.gain.setValueAtTime(0.18, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.05);
    });
  }

  /** Guard: metallic protective shield barrier */
  playWerewolfShield() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    this.playFilteredNoise(0.06, 3200, 6.0, 0.25);

    // Metallic shield resonance
    [440, 880, 1320].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    });
  }

  /** Hunter: bow twang and arrow impact */
  playWerewolfHunter() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Bowstring snap twang
    const twang = ctx.createOscillator();
    const twangGain = ctx.createGain();
    twang.type = "sawtooth";
    twang.frequency.setValueAtTime(260, now);
    twang.frequency.exponentialRampToValueAtTime(70, now + 0.1);

    twangGain.gain.setValueAtTime(0.3, now);
    twangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    twang.connect(twangGain);
    twangGain.connect(ctx.destination);
    twang.start(now);
    twang.stop(now + 0.1);

    // Arrow whoosh & wood target strike 80ms later
    this.playFilteredNoise(0.08, 1400, 3.5, 0.35, 0.08);
  }

  /** Wolf claw slash: ferocious tearing flesh strike with sharp transient & sub thud */
  playWerewolfClawSlash() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Sharp blade/claw tearing noise
    this.playFilteredNoise(0.12, 2400, 2.5, 0.45);
    this.playFilteredNoise(0.08, 1100, 3.0, 0.35, 0.04);

    // 2. Heavy flesh impact sub-thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Witch poison: dark bubbling toxic sizzle */
  playWitchPoison() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Bubbling noise burst
    this.playFilteredNoise(0.22, 1800, 5.0, 0.3);
    this.playFilteredNoise(0.18, 900, 4.0, 0.25, 0.05);

    // Sinister descending resonant whistle
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  /** Witch heal: sacred crystalline revitalizing chime */
  playWitchHeal() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [440, 554.37, 659.25, 880, 1108.73].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, now + idx * 0.06);
      gain.gain.setValueAtTime(0.14 / (idx + 1), now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.8);
    });
  }

  /** Cupid arrow: love chime with harp glissando */
  playCupidArrow() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + i * 0.04);
      gain.gain.setValueAtTime(0.16, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.6);
    });
  }

  /** Heartbeat: suspenseful double-thump (lub-dub) for werewolf card reveal */
  playHeartbeat() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // First beat: Lub (lower pitch, slightly louder)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(80, now);
    osc1.frequency.exponentialRampToValueAtTime(45, now + 0.12);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    // Second beat: Dub (slightly higher pitch, 160ms later)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(95, now + 0.16);
    osc2.frequency.exponentialRampToValueAtTime(50, now + 0.28);
    gain2.gain.setValueAtTime(0.28, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.16);
    osc2.stop(now + 0.3);
  }

  /** Fast roulette tick / card flutter click */
  playRouletteTick() {
    this.playFilteredNoise(0.02, 2800, 4.5, 0.12);
  }

  /** Dramatic card flight whoosh */
  playCardWhoosh() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.28), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(350, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.14);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.28);
    filter.Q.setValueAtTime(2.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.28);
  }

  /** Crisp card flip / table snap */
  playCardFlip() {
    this.playFilteredNoise(0.035, 1900, 3.2, 0.26);
    this.playFilteredNoise(0.04, 850, 2.0, 0.18, 0.02);
  }

  /** Ethereal glowing aura chime */
  playGlowAura() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.12 / (idx + 1), now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.7);
    });
  }

  /* -------------------------------------------------------------------------
   * TYPING BATTLE & ARCADE SOUND SET
   * ------------------------------------------------------------------------- */

  /** Mechanical keyboard click (tactile switch) */
  playTypingKeystroke() {
    this.playFilteredNoise(0.025, 3600, 4.0, 0.15);
  }

  /** Typing combo multiplier streak */
  playTypingCombo(combo = 1) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const baseFreq = 440;
    const step = Math.min(12, combo);
    const freq = baseFreq * Math.pow(2, step / 12);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Cyber slash laser blade */
  playCyberSlash() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    this.playFilteredNoise(0.08, 2800, 3.0, 0.3);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.1);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Arcade 8-bit explosion */
  playCyberHit() {
    this.playFilteredNoise(0.14, 800, 1.8, 0.4);
  }

  /** Arcade boss alert siren */
  playCyberBoss() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.2, 0.4].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, now + t);
      osc.frequency.linearRampToValueAtTime(880, now + t + 0.15);
      gain.gain.setValueAtTime(0.2, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.18);
    });
  }

  /* -------------------------------------------------------------------------
   * GENERAL & BACKWARDS COMPATIBILITY METHODS
   * ------------------------------------------------------------------------- */

  playTurn() {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  playMove() {
    this.playChessMove();
  }

  playPieceDrop() {
    this.playXiangqiMove();
  }

  playCapture() {
    this.playChessCapture();
  }

  playCheck() {
    this.playChessCheck();
  }

  playVictory() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.22, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.38);
    });
  }

  playDefeat() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [330, 311.13, 293.66, 220]; // Descending minor

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.18, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.45);
    });
  }

  playCoin() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  playBadgeUnlock() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.2, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.4);
    });
  }

  playNightAmbient() {
    this.playWerewolfNight();
  }

  playCardDraw() {
    // Card sliding off deck
    this.playFilteredNoise(0.07, 2400, 2.5, 0.22);
  }

  playCardPlay() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Card slapping onto table surface
    this.playFilteredNoise(0.05, 1600, 3.0, 0.3);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playUnoShout() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.2, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.3);
    });
  }

  playWildColor() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.18, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.25);
    });
  }

  playNotification() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

export const soundManager = new SoundPlayer();

export const playRouletteTick = () => soundManager.playRouletteTick();
export const playWerewolfClawSlash = () => soundManager.playWerewolfClawSlash();
export const playHeartbeat = () => soundManager.playHeartbeat();
export const playCardWhoosh = () => soundManager.playCardWhoosh();
export const playCardFlip = () => soundManager.playCardFlip();
export const playGlowAura = () => soundManager.playGlowAura();
export const playWitchPoison = () => soundManager.playWitchPoison();
export const playWitchHeal = () => soundManager.playWitchHeal();
export const playCupidArrow = () => soundManager.playCupidArrow();
