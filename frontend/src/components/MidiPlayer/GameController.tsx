import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MidiNote, GameNote, KeyState } from "@/types/midi";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface GameControllerProps {
  midiNotes: MidiNote[];
  pressedKeys: KeyState[];
  onGameStateChange: (gameNotes: GameNote[], currentTime: number) => void;
  onScoreChange: (score: number, combo: number) => void;
}

const HIT_WINDOW = 0.15; // 150ms window for hitting notes
const BASE_GAIN = 0.2;
const ATTACK = 0.01;
const RELEASE = 0.08;

const midiToFrequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export const GameController = ({
  midiNotes,
  pressedKeys,
  onGameStateChange,
  onScoreChange,
}: GameControllerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameNotes, setGameNotes] = useState<GameNote[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStartTimeRef = useRef<number | null>(null);
  const fallbackStartTimeRef = useRef<number | null>(null);
  const hasScheduledAudioRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const gameNotesRef = useRef<GameNote[]>([]);
  const currentTimeRef = useRef(0);

  const totalDuration = useMemo(() => {
    if (midiNotes.length === 0) {
      return 0;
    }

    return midiNotes.reduce((max, note) => {
      const endTime = note.time + note.duration;
      return endTime > max ? endTime : max;
    }, 0);
  }, [midiNotes]);

  const cancelAnimationFrameLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    cancelAnimationFrameLoop();
    audioStartTimeRef.current = null;
    fallbackStartTimeRef.current = null;
    hasScheduledAudioRef.current = false;

    const context = audioContextRef.current;
    if (context) {
      context.close().catch((error) => {
        console.error("Failed to close audio context", error);
      });
      audioContextRef.current = null;
    }
  }, [cancelAnimationFrameLoop]);

  const createInitialNotes = useCallback(() => {
    return midiNotes.map((note, index) => ({
      ...note,
      id: `note-${index}`,
      active: true,
      hit: false,
      missed: false,
    }));
  }, [midiNotes]);

  // Initialize game notes from MIDI
  useEffect(() => {
    const notes = createInitialNotes();
    setGameNotes(notes);
    gameNotesRef.current = notes;
    setIsPlaying(false);
    setCurrentTime(0);
    setScore(0);
    setCombo(0);
    onScoreChange(0, 0);
    onGameStateChange(notes, 0);
    cleanupAudio();
  }, [createInitialNotes, cleanupAudio, onGameStateChange, onScoreChange]);

  useEffect(() => {
    gameNotesRef.current = gameNotes;
  }, [gameNotes]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const scheduleNotes = useCallback(
    (context: AudioContext, offset: number) => {
      midiNotes.forEach((note) => {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(
          midiToFrequency(note.midi),
          offset + note.time
        );

        const velocity = Math.max(0.05, Math.min(note.velocity, 1));
        const startTime = offset + note.time;
        const duration = Math.max(note.duration, 0.05);
        const endTime = startTime + duration;
        const sustainTime = Math.max(startTime + ATTACK, endTime - RELEASE);
        const stopTime = endTime + RELEASE;
        const targetGain = velocity * BASE_GAIN;

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(
          targetGain,
          startTime + ATTACK
        );
        gainNode.gain.setValueAtTime(targetGain, sustainTime);
        gainNode.gain.linearRampToValueAtTime(0.0001, endTime);
        gainNode.gain.setValueAtTime(0, stopTime);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(startTime);
        oscillator.stop(stopTime);

        oscillator.onended = () => {
          oscillator.disconnect();
          gainNode.disconnect();
        };
      });

      hasScheduledAudioRef.current = true;
    },
    [midiNotes]
  );

  // Game loop
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrameLoop();
      return;
    }

    const tick = () => {
      const context = audioContextRef.current;
      let elapsed = currentTimeRef.current;

      if (context && audioStartTimeRef.current !== null) {
        elapsed = context.currentTime - audioStartTimeRef.current;
      } else if (fallbackStartTimeRef.current !== null) {
        elapsed =
          performance.now() / 1000 - fallbackStartTimeRef.current;
      }

      const limitedElapsed = Math.max(
        0,
        totalDuration ? Math.min(elapsed, totalDuration) : elapsed
      );

      setCurrentTime(limitedElapsed);
      onGameStateChange(gameNotesRef.current, limitedElapsed);

      if (totalDuration && limitedElapsed >= totalDuration) {
        setIsPlaying(false);
        if (context && context.state === "running") {
          context.suspend().catch((error) => {
            console.error("Failed to suspend audio context", error);
          });
        }
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return cancelAnimationFrameLoop;
  }, [cancelAnimationFrameLoop, isPlaying, onGameStateChange, totalDuration]);

  // Check for missed notes
  useEffect(() => {
    if (!isPlaying) return;

    setGameNotes((prev) => {
      const updated = prev.map((note) => {
        if (note.missed || note.hit || !note.active) return note;

        if (currentTime > note.time + HIT_WINDOW) {
          setCombo(0);
          return { ...note, missed: true, active: false };
        }
        return note;
      });

      gameNotesRef.current = updated;
      return updated;
    });
  }, [currentTime, isPlaying]);

  // Check for key presses
  useEffect(() => {
    if (!isPlaying) return;

    const pressedKeyIds = new Set(
      pressedKeys.filter((k) => k.pressed).map((k) => k.id)
    );

    setGameNotes((prev) => {
      let newScore = score;
      let newCombo = combo;
      let scoreChanged = false;

      const updated = prev.map((note) => {
        if (note.hit || note.missed || !note.active) return note;

        const keyId = note.midi % 48;
        const timeUntilNote = Math.abs(note.time - currentTime);

        if (pressedKeyIds.has(keyId) && timeUntilNote <= HIT_WINDOW) {
          newScore += Math.floor(100 * (1 + newCombo * 0.1));
          newCombo += 1;
          scoreChanged = true;
          return { ...note, hit: true, active: false };
        }

        return note;
      });

      if (scoreChanged) {
        setScore(newScore);
        setCombo(newCombo);
        onScoreChange(newScore, newCombo);
      }

      gameNotesRef.current = updated;
      return updated;
    });
  }, [pressedKeys, currentTime, isPlaying, score, combo, onScoreChange]);

  const handlePlay = useCallback(async () => {
    const AudioContextConstructor =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as Window & {
            webkitAudioContext?: typeof AudioContext;
          }).webkitAudioContext
        : undefined;

    if (!AudioContextConstructor) {
      toast.error("Seu navegador não suporta a reprodução de áudio.");
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    const context = audioContextRef.current;

    if (!context) {
      toast.error("Não foi possível inicializar o áudio.");
      return;
    }

    if (!hasScheduledAudioRef.current) {
      const offset = context.currentTime + 0.1 - currentTime;
      audioStartTimeRef.current = offset;
      scheduleNotes(context, offset);
    } else if (audioStartTimeRef.current === null) {
      audioStartTimeRef.current = context.currentTime - currentTime;
    }

    fallbackStartTimeRef.current = performance.now() / 1000 - currentTime;

    try {
      await context.resume();
      setIsPlaying(true);
    } catch (error) {
      console.error("Failed to resume audio context", error);
      toast.error("Não foi possível iniciar o áudio.");
    }
  }, [currentTime, scheduleNotes]);

  const handlePause = useCallback(() => {
    const context = audioContextRef.current;

    if (context && audioStartTimeRef.current !== null) {
      setCurrentTime(context.currentTime - audioStartTimeRef.current);
    } else if (fallbackStartTimeRef.current !== null) {
      setCurrentTime(performance.now() / 1000 - fallbackStartTimeRef.current);
    }

    setIsPlaying(false);
    if (context && context.state === "running") {
      context.suspend().catch((error) => {
        console.error("Failed to suspend audio context", error);
      });
    }
  }, []);

  const handleReset = useCallback(() => {
    const notes = createInitialNotes();
    setIsPlaying(false);
    setCurrentTime(0);
    setScore(0);
    setCombo(0);
    setGameNotes(notes);
    gameNotesRef.current = notes;
    onScoreChange(0, 0);
    onGameStateChange(notes, 0);
    cleanupAudio();
  }, [
    cleanupAudio,
    createInitialNotes,
    onGameStateChange,
    onScoreChange,
  ]);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return (
    <div className="flex items-center gap-4">
      <div className="flex gap-2">
        {!isPlaying ? (
          <Button onClick={handlePlay} size="lg">
            <Play className="h-5 w-5" />
          </Button>
        ) : (
          <Button onClick={handlePause} size="lg" variant="secondary">
            <Pause className="h-5 w-5" />
          </Button>
        )}
        <Button onClick={handleReset} size="lg" variant="outline">
          <RotateCcw className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex gap-8 ml-auto">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Score</div>
          <div className="text-2xl font-bold">{score}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Combo</div>
          <div className="text-2xl font-bold text-[hsl(var(--note-falling))]">
            {combo}x
          </div>
        </div>
      </div>
    </div>
  );
};
