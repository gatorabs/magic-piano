import { MidiNote } from "@/types/midi";

const A4_FREQUENCY = 440;
const A4_MIDI = 69;

const midiToFrequency = (midi: number) =>
  A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12);

const isBrowser = typeof window !== "undefined";

export class MusicPlayer {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private notes: MidiNote[] = [];
  private startTime = 0;
  private offset = 0;
  private playing = false;
  private nextNoteIndex = 0;
  private readonly scheduleAheadTime = 0.25;
  private activeSources = new Set<AudioScheduledSourceNode>();

  constructor(notes: MidiNote[] = []) {
    this.notes = notes;
  }

  setNotes(notes: MidiNote[]) {
    this.notes = notes;
    this.resetInternalState();
  }

  async play(currentTimeSeconds: number) {
    if (!isBrowser) {
      return;
    }

    const context = await this.ensureContext();

    this.playing = true;
    this.offset = currentTimeSeconds;
    this.startTime = context.currentTime - currentTimeSeconds;
    this.nextNoteIndex = this.findNextNoteIndex(currentTimeSeconds);

    if (context.state === "suspended") {
      await context.resume();
    }
  }

  async pause() {
    if (!this.audioContext) {
      return;
    }

    this.offset = this.getCurrentTime();
    this.playing = false;

    if (this.audioContext.state === "running") {
      await this.audioContext.suspend();
    }
  }

  async stop() {
    this.playing = false;
    this.offset = 0;
    this.startTime = 0;
    this.nextNoteIndex = 0;
    await this.stopActiveSources();
    if (this.audioContext && this.audioContext.state !== "suspended") {
      await this.audioContext.suspend().catch(() => undefined);
    }
  }

  dispose() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
      this.masterGain = null;
    }
  }

  schedule() {
    if (!this.playing || !this.audioContext || this.notes.length === 0) {
      return;
    }

    const context = this.audioContext;
    const playbackTime = this.getCurrentTime();
    const scheduleUntil = playbackTime + this.scheduleAheadTime;

    while (this.nextNoteIndex < this.notes.length) {
      const note = this.notes[this.nextNoteIndex];

      if (note.time <= playbackTime - 0.01) {
        this.nextNoteIndex += 1;
        continue;
      }

      if (note.time > scheduleUntil) {
        break;
      }

      const startAt = this.startTime + note.time;
      const endAt = startAt + Math.max(0.05, note.duration);

      if (endAt <= context.currentTime) {
        this.nextNoteIndex += 1;
        continue;
      }

      if (startAt >= context.currentTime) {
        this.scheduleNote(note, startAt, endAt);
      }

      this.nextNoteIndex += 1;
    }

    if (
      this.nextNoteIndex >= this.notes.length &&
      playbackTime > this.getTotalDuration() + 0.25
    ) {
      this.playing = false;
      this.offset = this.getTotalDuration();
    }
  }

  getCurrentTime() {
    if (!this.audioContext) {
      return this.offset;
    }

    if (!this.playing) {
      return this.offset;
    }

    return Math.max(0, this.audioContext.currentTime - this.startTime);
  }

  isPlaying() {
    return this.playing;
  }

  private async ensureContext() {
    if (this.audioContext) {
      return this.audioContext;
    }

    const contextClass =
      window.AudioContext ??
      ("webkitAudioContext" in window
        ? (window as Window & typeof globalThis & {
            webkitAudioContext: typeof AudioContext;
          }).webkitAudioContext
        : undefined);

    if (!contextClass) {
      throw new Error("Web Audio API is not supported in this browser.");
    }

    this.audioContext = new contextClass();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.audioContext.destination);
    return this.audioContext;
  }

  private findNextNoteIndex(time: number) {
    if (this.notes.length === 0) {
      return 0;
    }

    let index = 0;
    while (index < this.notes.length && this.notes[index].time < time - 0.05) {
      index += 1;
    }
    return index;
  }

  private getTotalDuration() {
    if (this.notes.length === 0) {
      return 0;
    }

    const lastNote = this.notes[this.notes.length - 1];
    return lastNote.time + lastNote.duration;
  }

  private scheduleNote(note: MidiNote, startAt: number, endAt: number) {
    if (!this.audioContext || !this.masterGain) {
      return;
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      midiToFrequency(note.midi),
      startAt
    );

    const velocity = Math.max(0.1, Math.min(note.velocity || 0.8, 1));
    gainNode.gain.setValueAtTime(0, startAt);
    gainNode.gain.linearRampToValueAtTime(velocity, startAt + 0.01);
    gainNode.gain.setTargetAtTime(0, endAt, 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(startAt);
    oscillator.stop(endAt + 0.1);

    const cleanup = () => {
      try {
        oscillator.disconnect();
      } catch (error) {
        console.warn("oscillator disconnect", error);
      }
      try {
        gainNode.disconnect();
      } catch (error) {
        console.warn("gain disconnect", error);
      }
      this.activeSources.delete(oscillator);
    };

    oscillator.onended = cleanup;
    this.activeSources.add(oscillator);
  }

  private async stopActiveSources() {
    if (this.activeSources.size === 0) {
      return;
    }

    const now = this.audioContext?.currentTime ?? 0;
    for (const source of Array.from(this.activeSources)) {
      try {
        source.stop(now);
      } catch (error) {
        console.warn("source stop", error);
      }
    }
    this.activeSources.clear();
  }

  private resetInternalState() {
    this.offset = 0;
    this.startTime = 0;
    this.nextNoteIndex = 0;
    this.playing = false;
    void this.stopActiveSources();
  }
}
