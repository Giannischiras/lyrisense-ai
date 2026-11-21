import { motion } from "framer-motion";
import { useState } from "react";

export type RevealFrom = { x: number; y: number; id: number };

// key page -> app. the change starts at the button you pressed: a cherry ring and a navy
// circle grow out of it until they cover the screen, the page swaps behind them, then a
// hole opens from the same point and shows the new page
export function CircleReveal({ from }: { from: RevealFrom | null }) {
  if (!from) return null;
  return <Run key={from.id} from={from} />;
}

export const REVEAL_COVER_MS = 500;

function Run({ from }: { from: RevealFrom }) {
  const [phase, setPhase] = useState<"cover" | "open" | "done">("cover");
  const { x, y } = from;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 40;
  const ease = [0.7, 0, 0.3, 1] as const;
  if (phase === "done") return null;

  if (phase === "cover") {
    return (
      <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
        {/* cherry goes first, the navy follows a bit later, so a red edge leads the way */}
        <motion.div
          className="absolute inset-0"
          style={{ background: "var(--color-pink)" }}
          initial={{ clipPath: `circle(0px at ${x}px ${y}px)` }}
          animate={{ clipPath: `circle(${r}px at ${x}px ${y}px)` }}
          transition={{ duration: 0.42, ease }}
        />
        <motion.div
          className="absolute inset-0"
          style={{ background: "var(--color-violet)" }}
          initial={{ clipPath: `circle(0px at ${x}px ${y}px)` }}
          animate={{ clipPath: `circle(${r}px at ${x}px ${y}px)` }}
          transition={{ duration: 0.42, delay: 0.07, ease }}
          onAnimationComplete={() => setPhase("open")}
        />
      </div>
    );
  }

  // a growing transparent hole in the navy, from the same point
  const hole = (p: number) => `radial-gradient(circle at ${x}px ${y}px, transparent ${p}px, #000 ${p + 1}px)`;
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{ background: "var(--color-violet)" }}
      aria-hidden
      initial={{ WebkitMaskImage: hole(0), maskImage: hole(0) }}
      animate={{ WebkitMaskImage: hole(r), maskImage: hole(r) }}
      transition={{ duration: 0.55, delay: 0.08, ease }}
      onAnimationComplete={() => setPhase("done")}
    />
  );
}
