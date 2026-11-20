import { motion } from "framer-motion";

export type WaveMode = "idle" | "typing" | "active";

// the equalizer bars. idle = slow breathing, typing = they react while you type,
// active = the agent is working
export function Wave({
  bars = 28,
  active = false,
  mode,
  className = "",
}: {
  bars?: number;
  active?: boolean;
  mode?: WaveMode;
  className?: string;
}) {
  const m: WaveMode = mode ?? (active ? "active" : "idle");
  return (
    <div className={`flex items-end justify-center gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        const base = 0.25 + 0.5 * Math.abs(Math.sin(i * 0.7));
        const anim =
          m === "active"
            ? [base, 1, base * 0.6, 0.9, base]
            : m === "typing"
              ? [base, Math.min(1, base + 0.45), base * 0.8, Math.min(1, base + 0.3), base]
              : [base, base * 1.25, base];
        const dur = m === "active" ? 0.9 + (i % 5) * 0.12 : m === "typing" ? 0.45 + (i % 4) * 0.08 : 2.4 + (i % 7) * 0.2;
        return (
          <motion.span
            key={i}
            className="w-[4px] rounded-full"
            style={{
              background: "linear-gradient(to top, var(--color-violet), var(--color-pink), var(--color-amber))",
              height: "100%",
              transformOrigin: "bottom",
            }}
            animate={{ scaleY: anim }}
            transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: i * (m === "typing" ? 0.02 : 0.04) }}
          />
        );
      })}
    </div>
  );
}
