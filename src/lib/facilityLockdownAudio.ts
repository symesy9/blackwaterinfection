/** Synthesized terminal SFX for the facility lockdown overlay. */

class FacilityLockdownAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.85;
        this.master.connect(this.ctx.destination);
      } catch {
        return;
      }
    }

    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  private getContext(): AudioContext | null {
    this.unlock();
    return this.ctx;
  }

  private getMaster(ctx: AudioContext): GainNode {
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(ctx.destination);
    }
    return this.master;
  }

  private playFilteredNoise(
    ctx: AudioContext,
    durationSec: number,
    volume: number,
    filterType: BiquadFilterType,
    frequency: number,
    q = 1,
    output: AudioNode = this.getMaster(ctx),
  ): void {
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const samples = buffer.getChannelData(0);

    for (let i = 0; i < sampleCount; i += 1) {
      const progress = i / sampleCount;
      const envelope = Math.pow(1 - progress, 2.4);
      samples[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.start();
  }

  private playTone(
    ctx: AudioContext,
    frequency: number,
    startTime: number,
    durationSec: number,
    volume: number,
    type: OscillatorType = "sine",
    output: AudioNode = this.getMaster(ctx),
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    osc.connect(gain);
    gain.connect(output);
    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.02);
  }

  /** Mechanical keyboard click — thock + high transient. */
  private playMechanicalKey(ctx: AudioContext, intensity = 1, terminal = false): void {
    const variance = 0.85 + Math.random() * 0.3;
    const clickHz = (terminal ? 2600 : 3200) + Math.random() * 900;
    const bodyHz = (terminal ? 420 : 520) + Math.random() * 180;

    this.playFilteredNoise(
      ctx,
      terminal ? 0.018 : 0.014,
      0.055 * intensity * variance,
      "bandpass",
      clickHz,
      2.2,
    );

    this.playFilteredNoise(
      ctx,
      terminal ? 0.04 : 0.032,
      0.07 * intensity * variance,
      "bandpass",
      bodyHz,
      1.1,
    );

    this.playTone(
      ctx,
      (terminal ? 880 : 1050) + Math.random() * 120,
      ctx.currentTime,
      0.022,
      0.012 * intensity,
      "triangle",
    );
  }

  playLogKeystroke(intensity = 1): void {
    const ctx = this.getContext();
    if (!ctx) return;
    this.playMechanicalKey(ctx, intensity, false);
  }

  playPasscodeKeystroke(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    this.playMechanicalKey(ctx, 1.1, true);

    this.playTone(ctx, 740 + Math.random() * 60, ctx.currentTime + 0.004, 0.035, 0.018, "square");
  }

  playPasscodeFail(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = this.getMaster(ctx);

    // Harsh security buzzer — two descending denial beeps.
    this.playTone(ctx, 392, now, 0.16, 0.11, "square", master);
    this.playTone(ctx, 196, now, 0.16, 0.07, "square", master);

    this.playTone(ctx, 311, now + 0.18, 0.22, 0.12, "sawtooth", master);
    this.playTone(ctx, 155, now + 0.18, 0.24, 0.08, "sawtooth", master);

    this.playFilteredNoise(ctx, 0.12, 0.09, "lowpass", 420, 0.8, master);

    // Final low klaxon tail.
    const klaxon = ctx.createOscillator();
    const klaxonGain = ctx.createGain();
    klaxon.type = "square";
    klaxon.frequency.setValueAtTime(130, now + 0.34);
    klaxon.frequency.exponentialRampToValueAtTime(90, now + 0.62);
    klaxonGain.gain.setValueAtTime(0.0001, now + 0.34);
    klaxonGain.gain.exponentialRampToValueAtTime(0.08, now + 0.36);
    klaxonGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.64);
    klaxon.connect(klaxonGain);
    klaxonGain.connect(master);
    klaxon.start(now + 0.34);
    klaxon.stop(now + 0.66);
  }

  playPasscodeSuccess(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = this.getMaster(ctx);

    // Access-granted chime — bright ascending arpeggio + confirmation tail.
    const notes = [
      { freq: 523.25, at: 0, dur: 0.12, vol: 0.07, type: "sine" as OscillatorType },
      { freq: 659.25, at: 0.09, dur: 0.12, vol: 0.075, type: "sine" as OscillatorType },
      { freq: 783.99, at: 0.18, dur: 0.14, vol: 0.08, type: "sine" as OscillatorType },
      { freq: 1046.5, at: 0.28, dur: 0.32, vol: 0.065, type: "triangle" as OscillatorType },
    ];

    for (const note of notes) {
      this.playTone(ctx, note.freq, now + note.at, note.dur, note.vol, note.type, master);
      this.playTone(
        ctx,
        note.freq * 2,
        now + note.at,
        note.dur * 0.65,
        note.vol * 0.22,
        "sine",
        master,
      );
    }

    this.playFilteredNoise(ctx, 0.05, 0.025, "highpass", 2400, 0.7, master);

    // Soft confirmation bloom on the final note.
    this.playTone(ctx, 1318.5, now + 0.34, 0.45, 0.028, "sine", master);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}

export const facilityLockdownAudio = new FacilityLockdownAudio();
