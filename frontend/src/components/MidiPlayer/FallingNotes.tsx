import { GameNote } from "@/types/midi";
import { cn } from "@/lib/utils";
import { BLACK_KEY_WIDTH_RATIO } from "@/constants/piano";

interface FallingNotesProps {
  notes: GameNote[];
  currentTime: number;
  lookAheadTime: number;
}

const isBlackKey = (midi: number): boolean => {
  const noteInOctave = midi % 12;
  return [1, 3, 6, 8, 10].includes(noteInOctave);
};

export const FallingNotes = ({ notes, currentTime, lookAheadTime }: FallingNotesProps) => {
  // Only show notes within lookAheadTime
  const safeLookAhead = Math.max(lookAheadTime, 0.001);
  const visibleNotes = notes.filter(
    (note) => note.time >= currentTime && note.time <= currentTime + safeLookAhead
  );
  const totalKeys = 48;
  const whiteKeyCount = Array.from({ length: totalKeys })
    .map((_, index) => index)
    .filter((index) => !isBlackKey(index)).length;
  const whiteKeyWidth = 100 / whiteKeyCount;

  return (
    <div className="relative w-full max-w-5xl mx-auto h-64 bg-gradient-to-b from-background/50 to-transparent overflow-hidden border-b-4 border-primary">
      <div className="absolute inset-0 pointer-events-none flex z-0">
        {Array.from({ length: whiteKeyCount }).map((_, index) => (
          <div
            key={`lane-${index}`}
            className={cn(
              "flex-1 border-l border-white/10 last:border-r",
              index % 2 === 0 ? "bg-white/[0.04]" : "bg-transparent"
            )}
          />
        ))}
      </div>
      {visibleNotes.map((note) => {
        // Calculate vertical position (0 = bottom, 1 = top)
        const timeUntilNote = note.time - currentTime;
        const clampedTimeUntil = Math.min(Math.max(timeUntilNote, 0), safeLookAhead);
        const bottomPosition = (clampedTimeUntil / safeLookAhead) * 100;

        // Calculate horizontal position based on MIDI note
        const keyId = note.midi % totalKeys; // Assuming 48 keys
        const whiteKeysBeforeThis = Array.from({ length: keyId })
          .filter((_, i) => !isBlackKey(i))
          .length;
        const isBlack = isBlackKey(keyId);
        const leftPercent = isBlack
          ? (whiteKeysBeforeThis + 0.5) * whiteKeyWidth
          : whiteKeysBeforeThis * whiteKeyWidth;

        return (
          <div
            key={note.id}
            className={cn(
              "absolute transition-all duration-75 rounded-t z-10",
              isBlack
                ? "bg-[hsl(var(--note-falling-black))]"
                : "bg-[hsl(var(--note-falling-white))]",
              note.hit && "bg-[hsl(var(--note-correct))]",
              note.missed && "bg-[hsl(var(--note-miss))] opacity-50",
              !note.active && "opacity-0"
            )}
            style={{
              bottom: `${bottomPosition}%`,
              left: `${leftPercent}%`,
              width: `${(isBlack ? BLACK_KEY_WIDTH_RATIO : 1) * whiteKeyWidth}%`,
              transform: isBlack ? "translateX(-50%)" : undefined,
              height: `${Math.max(20, note.duration * 50)}px`,
              boxShadow: note.active
                ? "0 0 18px currentColor"
                : isBlack
                  ? "0 0 12px rgba(88, 63, 191, 0.35)"
                  : "0 0 12px rgba(255, 192, 203, 0.35)",
            }}
          />
        );
      })}
    </div>
  );
};
