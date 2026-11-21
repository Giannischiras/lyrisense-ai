import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export type WaveMode = "idle" | "typing" | "active";

// the equalizer bars. idle = slow breathing, active = the agent is working.
// `kick` is a counter: every time it changes (a key press) one random bar jumps up and
// falls back, the others keep breathing. calmer than moving all of them on every key
export function Wave({
  bars = 28,
  active = false,
  mode,
  kick = 0,
  className = "",
}: {
  bars?: number;
  active?: boolean;
  mode?: WaveMode;
  kick?: number;
  className?: string;
}) {
  const m: WaveMode = mode ?? (active ? "active" : "idle");
  const [hit, setHit] = useState<{ bar: number; n: number }>({ bar: -1, n: 0 });
  const last = useRef(-1);

  useEffect(() => {
    if (!kick) return;
    let bar = Math.floor(Math.random() * bars);
    if (bar === last.current) bar = (bar + 1 + Math.floor(Math.random() * (bars - 1))) % bars;
    last.current = bar;
    setHit((h) => ({ bar, n: h.n + 1 }));
  }, [kick, bars]);

  return (
    <div className={`flex items-end justify-center gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <Bar key={i} i={i} mode={m} kick={hit.bar === i ? hit.n : 0} />
      ))}
    </div>
  );
}

function Bar({ i, mode, kick }: { i: number; mode: WaveMode; kick: number }) {
  const base = 0.25 + 0.5 * Math.abs(Math.sin(i * 0.7));
  const anim =
    mode === "active"
      ? [base, 1, base * 0.6, 0.9, base]
      : mode === "typing"
        ? [base, Math.min(1, base + 0.45), base * 0.8, Math.min(1, base + 0.3), base]
        : [base, base * 1.2, base];
  const dur = mode === "active" ? 0.9 + (i % 5) * 0.12 : mode === "typing" ? 0.45 + (i % 4) * 0.08 : 2.4 + (i % 7) * 0.2;

  // the jump goes on an inner layer, so it adds to the breathing instead of cutting it
  const jump = useAnimationControls();
  useEffect(() => {
    if (!kick) return;
    const top = 0.95 / base; // up to about full height, also for the short bars
    jump.start({
      scaleY: [1, top, 1],
      transition: { duration: 0.55, times: [0, 0.25, 1], ease: ["easeOut", [0.22, 1, 0.36, 1]] },
    });
  }, [kick, base, jump]);

  return (
    <motion.span
      className="flex w-[4px] items-end"
      style={{ height: "100%", transformOrigin: "bottom" }}
      animate={{ scaleY: anim }}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: i * (mode === "typing" ? 0.02 : 0.04) }}
    >
      <motion.span
        className="w-full rounded-full"
        animate={jump}
        style={{
          height: "100%",
          transformOrigin: "bottom",
          background: "linear-gradient(to top, var(--color-violet), var(--color-amber) 80%, var(--color-pink))",
        }}
      />
    </motion.span>
  );
}
