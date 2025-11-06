import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface PianoKeyProps {
  keyId: number;
  isPressed: boolean;
  isBlack: boolean;
  isExpected?: boolean;
  isCorrect?: boolean;
  isMissed?: boolean;
  style?: CSSProperties;
}

export const PianoKey = ({
  keyId,
  isPressed,
  isBlack,
  isExpected,
  isCorrect,
  isMissed,
  style,
}: PianoKeyProps) => {
  return (
    <div
      className={cn(
        "transition-all duration-75 border-2 flex items-end justify-center pb-1 text-[10px] font-mono select-none",
        isBlack
          ? "h-32 bg-[hsl(var(--piano-black))] text-white border-gray-700 z-10 rounded-b"
          : "h-48 bg-[hsl(var(--piano-white))] text-gray-600 border-gray-300 rounded-b",
        isPressed && "bg-[hsl(var(--piano-pressed))] scale-95 shadow-inner",
        isExpected && !isPressed && "ring-4 ring-[hsl(var(--note-falling))] ring-opacity-50",
        isCorrect && "bg-[hsl(var(--note-correct))] text-white",
        isMissed && "bg-[hsl(var(--note-miss))] text-white"
      )}
      style={style}
    >
      {keyId}
    </div>
  );
};
