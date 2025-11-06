import { GameNote } from "@/types/midi";
import { cn } from "@/lib/utils";

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
  const visibleNotes = notes.filter(
    (note) => note.time >= currentTime && note.time <= currentTime + lookAheadTime
  );

  return (
    <div className="relative w-full h-64 bg-gradient-to-b from-background/50 to-transparent overflow-hidden border-b-4 border-primary">
      {visibleNotes.map((note) => {
        // Calculate vertical position (0 = bottom, 1 = top)
        const timeUntilNote = note.time - currentTime;
        const verticalProgress = 1 - (timeUntilNote / lookAheadTime);
        const topPosition = verticalProgress * 100;

        // Calculate horizontal position based on MIDI note
        const keyId = note.midi % 48; // Assuming 48 keys
        const whiteKeysBeforeThis = Array.from({ length: keyId })
          .filter((_, i) => !isBlackKey(i))
          .length;
        const isBlack = isBlackKey(keyId);
        const leftPosition = isBlack
          ? whiteKeysBeforeThis * 48 + 36
          : whiteKeysBeforeThis * 48;

        return (
          <div
            key={note.id}
            className={cn(
              "absolute transition-all duration-75 rounded-t",
              isBlack ? "w-8 bg-purple-600" : "w-12 bg-[hsl(var(--note-falling))]",
              note.hit && "bg-[hsl(var(--note-correct))]",
              note.missed && "bg-[hsl(var(--note-miss))] opacity-50",
              !note.active && "opacity-0"
            )}
            style={{
              bottom: `${topPosition}%`,
              left: `${leftPosition}px`,
              height: `${Math.max(20, note.duration * 50)}px`,
              boxShadow: note.active ? "0 0 10px currentColor" : "none",
            }}
          />
        );
      })}
    </div>
  );
};
