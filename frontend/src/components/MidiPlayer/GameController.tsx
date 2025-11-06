import { useState, useEffect, useCallback, useRef } from "react";
import { MidiNote, GameNote, KeyState } from "@/types/midi";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import { MusicPlayer } from "@/lib/musicPlayer";

interface GameControllerProps {
  midiNotes: MidiNote[];
  pressedKeys: KeyState[];
  onGameStateChange: (gameNotes: GameNote[], currentTime: number) => void;
  onScoreChange: (score: number, combo: number) => void;
}

const HIT_WINDOW = 0.15; // 150ms window for hitting notes

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
  const musicPlayerRef = useRef<MusicPlayer | null>(null);

  if (!musicPlayerRef.current) {
    musicPlayerRef.current = new MusicPlayer();
  }

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
  }, [midiNotes]);

  // Game loop
  useEffect(() => {
    const player = musicPlayerRef.current;

    let animationId: number;

    const updateLoop = () => {
      if (player?.isPlaying()) {
        player.schedule();
        setCurrentTime(player.getCurrentTime());
      }
      animationId = requestAnimationFrame(updateLoop);
    };

    animationId = requestAnimationFrame(updateLoop);

    return () => cancelAnimationFrame(animationId);
  }, []);

  useEffect(() => {
    musicPlayerRef.current?.setNotes(midiNotes);
  }, [midiNotes]);

  useEffect(() => {
    return () => {
      musicPlayerRef.current?.dispose();
      musicPlayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    onGameStateChange(gameNotes, currentTime);
  }, [gameNotes, currentTime, onGameStateChange]);

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
        onScoreChange(newScore, newCombo);
      }

      return updated;
    });
  }, [pressedKeys, currentTime, isPlaying, score, combo, onScoreChange]);

  const handlePlay = useCallback(async () => {
    await musicPlayerRef.current?.play(currentTime);
    setIsPlaying(true);
  }, [currentTime]);

  const handlePause = useCallback(async () => {
    setIsPlaying(false);
    await musicPlayerRef.current?.pause();
    setCurrentTime(musicPlayerRef.current?.getCurrentTime() ?? 0);
  }, []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setScore(0);
    setCombo(0);
    void musicPlayerRef.current?.stop();
    setGameNotes((prev) =>
      prev.map((note) => ({
        ...note,
        active: true,
        hit: false,
        missed: false,
      }))
    );
  }, []);

  const totalDuration = midiNotes.length
    ? midiNotes[midiNotes.length - 1].time + midiNotes[midiNotes.length - 1].duration
    : 0;

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    if (currentTime >= totalDuration) {
      setIsPlaying(false);
      void musicPlayerRef.current?.pause();
      setCurrentTime(totalDuration);
    }
  }, [currentTime, isPlaying, totalDuration]);

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
