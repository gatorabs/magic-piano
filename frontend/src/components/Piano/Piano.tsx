import { PianoKey } from "./PianoKey";
import { KeyState } from "@/types/midi";
import { BLACK_KEY_WIDTH_RATIO } from "@/constants/piano";

interface PianoProps {
  keys: KeyState[];
  expectedKeys?: Set<number>;
  correctKeys?: Set<number>;
  missedKeys?: Set<number>;
}

// Pattern for 48 keys (4 octaves): C, C#, D, D#, E, F, F#, G, G#, A, A#, B
const isBlackKey = (keyId: number): boolean => {
  const noteInOctave = keyId % 12;
  return [1, 3, 6, 8, 10].includes(noteInOctave);
};

export const Piano = ({ keys, expectedKeys, correctKeys, missedKeys }: PianoProps) => {
  // Sort keys to ensure correct order
  const sortedKeys = [...keys].sort((a, b) => a.id - b.id);

  // Separate white and black keys for proper rendering
  const whiteKeys = sortedKeys.filter((k) => !isBlackKey(k.id));
  const whiteKeyCount = Math.max(whiteKeys.length, 1);
  const whiteKeyWidth = 100 / whiteKeyCount;

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* White keys layer */}
      <div className="flex w-full">
        {whiteKeys.map((key) => (
          <PianoKey
            key={key.id}
            keyId={key.id}
            isPressed={key.pressed}
            isBlack={false}
            isExpected={expectedKeys?.has(key.id)}
            isCorrect={correctKeys?.has(key.id)}
            isMissed={missedKeys?.has(key.id)}
            style={{ width: `${whiteKeyWidth}%` }}
          />
        ))}
      </div>

      {/* Black keys layer (absolute positioned) */}
      <div className="absolute inset-0 pointer-events-none">
        {sortedKeys.map((key) => {
          if (!isBlackKey(key.id)) return null;

          // Calculate position based on key ID
          const whiteKeysBeforeThis = sortedKeys
            .filter((k) => k.id < key.id && !isBlackKey(k.id))
            .length;

          return (
            <div
              key={key.id}
              className="absolute flex justify-center"
              style={{
                left: `${(whiteKeysBeforeThis + 0.5) * whiteKeyWidth}%`,
                width: `${whiteKeyWidth}%`,
                transform: "translateX(-50%)",
              }}
            >
              <PianoKey
                keyId={key.id}
                isPressed={key.pressed}
                isBlack={true}
                isExpected={expectedKeys?.has(key.id)}
                isCorrect={correctKeys?.has(key.id)}
                isMissed={missedKeys?.has(key.id)}
                style={{
                  width: `${BLACK_KEY_WIDTH_RATIO * 100}%`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
