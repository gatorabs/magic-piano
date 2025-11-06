import { cn } from "@/lib/utils";

interface PianoKeyProps {
  keyId: number;
  isPressed: boolean;
  isBlack: boolean;
  isExpected?: boolean;
  isCorrect?: boolean;
  isMissed?: boolean;
}

export const PianoKey = ({
  keyId,
  isPressed,
  isBlack,
  isExpected,
  isCorrect,
  isMissed,
}: PianoKeyProps) => {
  return (
    <div
      className={cn(
        "transition-all duration-75 border-2 flex items-end justify-center pb-2 text-xs font-mono",
        isBlack
          ? "w-8 h-32 bg-[hsl(var(--piano-black))] text-white border-gray-700 -mx-4 z-10 rounded-b"
          : "w-12 h-48 bg-[hsl(var(--piano-white))] text-gray-600 border-gray-300 rounded-b",
        isPressed && "bg-[hsl(var(--piano-pressed))] scale-95 shadow-inner",
        isExpected && !isPressed && "ring-4 ring-[hsl(var(--note-falling))] ring-opacity-50",
        isCorrect && "bg-[hsl(var(--note-correct))] text-white",
        isMissed && "bg-[hsl(var(--note-miss))] text-white"
      )}
    >
      {keyId}
    </div>
  );
};
