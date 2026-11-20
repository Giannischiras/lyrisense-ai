import { motion, useReducedMotion } from "framer-motion";
import type { Mood } from "../api";

// words that float up slowly behind the start screen, like lines from songs
const WORDS = [
  "missing you", "midnight", "heartbreak", "θάλασσα", "summer rain", "alone again",
  "μου λείπεις", "dance all night", "home", "καλοκαίρι", "golden hour", "νύχτα",
];

// the light behind the page takes the color of the mood the agent picked
export const MOOD_COLORS: Record<Mood | "default", [string, string]> = {
  default: ["#f26b83", "#ffc187"],
  sad: ["#6f86f0", "#9a86e0"],
  angry: ["#f05454", "#f2884b"],
  happy: ["#ffc46b", "#ff9a8b"],
  chill: ["#5cc8c2", "#7aa7f0"],
  romantic: ["#f285b5", "#f26b83"],
  energetic: ["#ff7a59", "#ffd166"],
  nostalgic: ["#d9a066", "#c98bb9"],
  dark: ["#8a6cc0", "#4a5aa8"],
};

export function Background({ words = true, mood }: { words?: boolean; mood?: Mood | null }) {
  const reduce = useReducedMotion();
  const [a, b] = MOOD_COLORS[mood ?? "default"];
  return (
    <div className="aurora" aria-hidden style={{ "--glow-a": a, "--glow-b": b } as React.CSSProperties}>
      <div className="glow" />
      {words &&
        !reduce &&
        WORDS.map((w, i) => {
          const left = (i * 61) % 92;
          const dur = 30 + (i % 5) * 6;
          return (
            <motion.span
              key={w}
              className="absolute select-none whitespace-nowrap font-display font-semibold text-white"
              style={{ left: `${left + 2}%`, fontSize: `${14 + (i % 4) * 5}px` }}
              initial={{ y: "110vh", opacity: 0 }}
              animate={{ y: "-15vh", opacity: [0, 0.06, 0.06, 0] }}
              transition={{ duration: dur, repeat: Infinity, delay: -(i * dur) / WORDS.length, ease: "linear" }}
            >
              {w}
            </motion.span>
          );
        })}
    </div>
  );
}
