import { useCallback, useRef } from "react";
import { MidiNote } from "@/types/midi";

type AudioContextConstructor = typeof AudioContext;

const getAudioContextConstructor = (): AudioContextConstructor | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const webkitContext = (window as Window & typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  }).webkitAudioContext;

  return window.AudioContext || webkitContext;
};

const midiToFrequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

interface ScheduledNode {
  source: OscillatorNode;
  gain: GainNode;
}

export const useMidiAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const scheduledNodesRef = useRef<ScheduledNode[]>([]);
  const notesRef = useRef<MidiNote[]>([]);

  const ensureContext = useCallback(() => {
    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    return audioContextRef.current;
  }, []);

  const loadNotes = useCallback((notes: MidiNote[]) => {
    notesRef.current = notes;
  }, []);

  const stopAll = useCallback(() => {
    scheduledNodesRef.current.forEach(({ source, gain }) => {
      try {
        source.stop();
      } catch (error) {
        console.error("Error stopping oscillator", error);
      }
      source.disconnect();
      gain.disconnect();
    });
    scheduledNodesRef.current = [];
  }, []);

  const playFrom = useCallback(
    async (startAtSeconds = 0) => {
      const context = ensureContext();
      if (!context) {
        return;
      }

      await context.resume();
      stopAll();

      const now = context.currentTime;
      const notes = notesRef.current;

      notes.forEach((note) => {
        const relativeStart = note.time - startAtSeconds;
        const relativeEnd = relativeStart + note.duration;

        if (relativeEnd <= 0) {
          return;
        }

        const startTime = now + Math.max(0, relativeStart);
        const duration = Math.max(0.05, note.duration);
        const stopTime = startTime + duration;

        const oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = midiToFrequency(note.midi);

        const gainNode = context.createGain();
        const velocity = Math.max(0.1, Math.min(1, note.velocity || 0.8));

        gainNode.gain.setValueAtTime(velocity, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(startTime);
        oscillator.stop(stopTime);

        scheduledNodesRef.current.push({ source: oscillator, gain: gainNode });
      });
    },
    [ensureContext, stopAll]
  );

  const pause = useCallback(() => {
    stopAll();
  }, [stopAll]);

  const stop = useCallback(() => {
    stopAll();
    const context = audioContextRef.current;
    if (context && context.state === "running") {
      context
        .suspend()
        .catch((error) => console.error("Failed to suspend audio context", error));
    }
  }, [stopAll]);

  return {
    loadNotes,
    playFrom,
    pause,
    stop,
  };
};
