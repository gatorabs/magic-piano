import { useState, useEffect, useCallback } from "react";
import { MidiNote, GameNote, KeyState } from "@/types/midi";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";

interface GameControllerProps {
  midiNotes: MidiNote[];
  pressedKeys: KeyState[];
  onGameStateChange: (gameNotes: GameNote[], currentTime: number) => void;
  onScoreChange: (score: number, combo: number) => void;
  onPlay?: (startTime: number) => void | Promise<void>;
  onPause?: () => void | Promise<void>;
  onReset?: () => void | Promise<void>;
  onSongComplete?: (params: { score: number; maxCombo: number }) => void;
  onPlaybackStart?: () => void;
  onPlaybackPause?: () => void;
  onPlaybackReset?: () => void;
}

const HIT_WINDOW = 0.15; // 150ms window for hitting notes

export const GameController = ({
  midiNotes,
  pressedKeys,
  onGameStateChange,
  onScoreChange,
  onPlay,
  onPause,
  onReset,
  onSongComplete,
  onPlaybackStart,
  onPlaybackPause,
  onPlaybackReset,
}: GameControllerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [gameNotes, setGameNotes] = useState<GameNote[]>([]);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const startPlayback = useCallback(() => {
    setIsPlaying(true);
    setStartTime(Date.now() - currentTime * 1000);
    setHasCompleted(false);
    onPlay?.(currentTime);
    onPlaybackStart?.();
  }, [currentTime, onPlay, onPlaybackStart]);

  // Initialize game notes from MIDI
  useEffect(() => {
    const notes: GameNote[] = midiNotes.map((note, index) => ({
      ...note,
      id: `note-${index}`,
      active: true,
      hit: false,
      missed: false,
    }));
    setGameNotes(notes);
    setCurrentTime(0);
    setStartTime(null);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setHasCompleted(false);
    setIsPlaying(false);
    setIsCountdownActive(false);
    setCountdown(null);
  }, [midiNotes]);

  // Game loop
  useEffect(() => {
    if (!isPlaying || !startTime) return;

    const intervalId = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setCurrentTime(elapsed);
      onGameStateChange(gameNotes, elapsed);
    }, 16); // ~60fps

    return () => clearInterval(intervalId);
  }, [isPlaying, startTime, gameNotes, onGameStateChange]);

  // Check for missed notes
  useEffect(() => {
    if (!isPlaying) return;

    setGameNotes((prev) =>
      prev.map((note) => {
        if (note.missed || note.hit || !note.active) return note;
        
        if (currentTime > note.time + HIT_WINDOW) {
          setCombo(0);
          return { ...note, missed: true, active: false };
        }
        return note;
      })
    );
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
        setMaxCombo((prevMax) => (newCombo > prevMax ? newCombo : prevMax));
        onScoreChange(newScore, newCombo);
      }

      return updated;
    });
  }, [pressedKeys, currentTime, isPlaying, score, combo, onScoreChange]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    if (gameNotes.length === 0) {
      return;
    }

    const allNotesProcessed = gameNotes.every((note) => !note.active);
    if (allNotesProcessed && !hasCompleted) {
      setHasCompleted(true);
      setIsPlaying(false);
      onPause?.();
      onSongComplete?.({ score, maxCombo });
    }
  }, [gameNotes, hasCompleted, isPlaying, maxCombo, onPause, onSongComplete, score]);

  const handlePlay = useCallback(() => {
    if (isCountdownActive) {
      return;
    }

    setCountdown(3);
    setIsCountdownActive(true);
  }, [isCountdownActive]);

  const handlePause = useCallback(() => {
    setIsCountdownActive(false);
    setCountdown(null);
    setIsPlaying(false);
    onPause?.();
    onPlaybackPause?.();
  }, [onPause, onPlaybackPause]);

  const handleReset = useCallback(() => {
    setIsCountdownActive(false);
    setCountdown(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setStartTime(null);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setGameNotes((prev) =>
      prev.map((note) => ({
        ...note,
        active: true,
        hit: false,
        missed: false,
      }))
    );
    setHasCompleted(false);
    onReset?.();
    onPlaybackReset?.();
  }, [onReset, onPlaybackReset]);

  useEffect(() => {
    if (!isCountdownActive || countdown === null) {
      return;
    }

    if (countdown <= 0) {
      setIsCountdownActive(false);
      setCountdown(null);
      startPlayback();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev ?? 1) - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isCountdownActive, startPlayback]);

  return (
    <div className="relative flex w-full items-center gap-4">
      <div className="flex gap-2">
        {!isPlaying ? (
          <Button onClick={handlePlay} size="lg" disabled={isCountdownActive}>
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

      {isCountdownActive && countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-lg bg-background/80 px-8 py-4 text-4xl font-bold text-primary shadow-lg">
            {countdown}
          </div>
        </div>
      )}
    </div>
  );
};
