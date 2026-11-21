import { AnimatePresence, motion, useAnimationControls, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Mood } from "../api";

// words that float up slowly behind the start screen, like lines from songs
const WORDS = [
  "missing you",
  "midnight",
  "heartbreak",
  "θάλασσα",
  "summer rain",
  "alone again",
  "μου λείπεις",
  "dance all night",
  "home",
  "καλοκαίρι",
  "golden hour",
  "νύχτα",
];

// the light behind the page takes the color of the mood the agent picked
export const MOOD_COLORS: Record<Mood | "default", [string, string]> = {
  default: ["#e01e3c", "#34507f"],
  sad: ["#6f86f0", "#9a86e0"],
  angry: ["#f05454", "#f2884b"],
  happy: ["#ffc46b", "#ff9a8b"],
  chill: ["#5cc8c2", "#7aa7f0"],
  romantic: ["#f285b5", "#f26b83"],
  energetic: ["#ff7a59", "#ffd166"],
  nostalgic: ["#d9a066", "#c98bb9"],
  dark: ["#8a6cc0", "#4a5aa8"],
};

// 3 depths: far words move a little with the mouse, near ones more (parallax)
const DEPTHS = [8, 18, 34];

export function Background({
  words = true,
  lyrics = [],
  mood,
  running = false,
  kick = 0,
}: {
  words?: boolean;
  lyrics?: string[];
  mood?: Mood | null;
  running?: boolean;
  kick?: number;
}) {
  const reduce = useReducedMotion();
  const [a, b] = MOOD_COLORS[mood ?? "default"];
  // start screen: the fixed words. in the chat: lines from the last playlist's lyrics
  const list = words ? WORDS : lyrics;
  const listKey = list.join("|");

  // mouse position from -0.5 to 0.5, smoothed so everything follows a bit late
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 40, damping: 18 });
  const sy = useSpring(my, { stiffness: 40, damping: 18 });
  useEffect(() => {
    if (reduce) return;
    const move = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [reduce, mx, my]);

  // the light drifts toward the cursor, slower than the words
  const glowX = useTransform(sx, (v) => `${v * 18}vw`);
  const glowY = useTransform(sy, (v) => `${v * 14}vh`);

  // a ring of the new mood color spreads from the input when a playlist arrives
  const [ripple, setRipple] = useState(0);
  const last = useRef<Mood | null | undefined>(mood);
  useEffect(() => {
    if (mood && mood !== last.current) setRipple((r) => r + 1);
    last.current = mood;
  }, [mood]);

  return (
    <div className="aurora" aria-hidden style={{ "--glow-a": a, "--glow-b": b } as React.CSSProperties}>
      {/* the css drift animation owns .glow's transform, so the scale goes on the wrapper */}
      <motion.div
        className="absolute inset-0"
        style={{ x: glowX, y: glowY }}
        animate={{ scale: running ? 1.08 : 1 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      >
        <motion.div className="glow" animate={{ opacity: running ? 0.3 : 0.16 }} transition={{ duration: 1.2, ease: "easeInOut" }} />
      </motion.div>

      <AnimatePresence>
        {ripple > 0 && !reduce && (
          <motion.div
            key={ripple}
            className="absolute bottom-0 left-1/2 h-[60vmax] w-[60vmax] rounded-full"
            style={{ x: "-50%", y: "50%", background: `radial-gradient(circle, ${a}55, ${b}22 45%, transparent 70%)` }}
            initial={{ scale: 0, opacity: 0.9 }}
            animate={{ scale: 3.2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>

      {/* while the agent works the edges get a soft shade, so the eye goes to the middle */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(20,33,61,0.10) 100%)" }}
        animate={{ opacity: running ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      />

      {list.length > 0 && !reduce && (
        <AnimatePresence mode="wait">
          <motion.div
            key={listKey}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          >
            {DEPTHS.map((depth, layer) => (
              <ParallaxLayer key={depth} depth={depth} sx={sx} sy={sy}>
                {list
                  .filter((_, i) => i % DEPTHS.length === layer)
                  .map((w, j) => {
                    const i = j * DEPTHS.length + layer;
                    const left = (i * 61) % 80;
                    const dur = 30 + (i % 5) * 6;
                    // lyric lines are longer, so a bit smaller and in italic like a quote
                    const size = words ? 12 + layer * 6 + (i % 2) * 3 : 12 + layer * 4 + (i % 2) * 2;
                    return (
                      <motion.span
                        key={w}
                        className={`absolute select-none whitespace-nowrap font-display font-semibold text-fg ${words ? "" : "italic"}`}
                        style={{ left: `${left + 2}%`, fontSize: `${size}px` }}
                        initial={{ y: "110vh", opacity: 0 }}
                        animate={{ y: "-15vh", opacity: [0, 0.05 + layer * 0.02, 0.05 + layer * 0.02, 0] }}
                        transition={{ duration: dur, repeat: Infinity, delay: -(i * dur) / list.length, ease: "linear" }}
                      >
                        {w}
                      </motion.span>
                    );
                  })}
              </ParallaxLayer>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      <FloorEq running={running} kick={kick} reduce={!!reduce} />
    </div>
  );
}

function ParallaxLayer({
  depth,
  sx,
  sy,
  children,
}: {
  depth: number;
  sx: ReturnType<typeof useSpring>;
  sy: ReturnType<typeof useSpring>;
  children: React.ReactNode;
}) {
  const x = useTransform(sx, (v) => v * -depth);
  const y = useTransform(sy, (v) => v * -depth);
  return (
    <motion.div className="absolute inset-0" style={{ x, y }}>
      {children}
    </motion.div>
  );
}

// a wide, faint equalizer along the bottom of the screen. it breathes slowly, every key
// press makes one random bar jump (like the logo), and while the agent works they all move
const FLOOR_BARS = 56;

function FloorEq({ running, kick, reduce }: { running: boolean; kick: number; reduce: boolean }) {
  const [hit, setHit] = useState({ bar: -1, n: 0 });
  const last = useRef(-1);
  useEffect(() => {
    if (!kick) return;
    let bar = Math.floor(Math.random() * FLOOR_BARS);
    if (bar === last.current) bar = (bar + 7) % FLOOR_BARS;
    last.current = bar;
    setHit((h) => ({ bar, n: h.n + 1 }));
  }, [kick]);

  return (
    <div
      className="absolute inset-x-0 bottom-0 flex h-[13vh] items-end gap-[6px] px-[6px]"
      style={{
        maskImage: "linear-gradient(to top, #000 30%, transparent)",
        WebkitMaskImage: "linear-gradient(to top, #000 30%, transparent)",
      }}
    >
      {Array.from({ length: FLOOR_BARS }).map((_, i) => (
        <FloorBar key={i} i={i} running={running} kick={hit.bar === i ? hit.n : 0} reduce={reduce} />
      ))}
    </div>
  );
}

function FloorBar({ i, running, kick, reduce }: { i: number; running: boolean; kick: number; reduce: boolean }) {
  // a gentle hill shape: a bit taller in the middle, with some noise
  const center = 1 - Math.abs(i / (FLOOR_BARS - 1) - 0.5) * 1.2;
  const base = 0.18 + 0.32 * center * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.7)));
  const anim = running ? [base, Math.min(1, base * 2.6), base * 0.7, Math.min(1, base * 2), base] : [base, base * 1.25, base];
  const dur = running ? 0.8 + (i % 6) * 0.13 : 3 + (i % 9) * 0.3;

  const jump = useAnimationControls();
  useEffect(() => {
    if (!kick) return;
    jump.start({
      scaleY: [1, Math.min(2.4, 0.9 / base), 1],
      transition: { duration: 0.7, times: [0, 0.22, 1], ease: ["easeOut", [0.22, 1, 0.36, 1]] },
    });
  }, [kick, base, jump]);

  return (
    <motion.div
      className="flex h-full flex-1 items-end"
      style={{ transformOrigin: "bottom" }}
      initial={{ scaleY: base }}
      animate={reduce ? { scaleY: base } : { scaleY: anim }}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }}
    >
      <motion.div
        className="h-full w-full rounded-t-full"
        animate={jump}
        style={{
          transformOrigin: "bottom",
          background: "linear-gradient(to top, var(--color-violet), var(--color-amber) 70%, var(--color-pink))",
          opacity: 0.07,
        }}
      />
    </motion.div>
  );
}
