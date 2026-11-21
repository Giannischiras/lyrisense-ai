import { motion } from "framer-motion";

const BARS = 18;

// page change: the logo's bars grow into full screen columns. they rise from the bottom
// (middle ones first, like an equalizer), cover the page while it changes behind them,
// then keep going up and reveal the new page. `run` is a counter, every new value plays it once
export function EqualizerWipe({ run }: { run: number }) {
  if (!run) return null;
  const mid = (BARS - 1) / 2;
  return (
    <div key={run} className="pointer-events-none fixed inset-0 z-[60] flex" aria-hidden>
      {Array.from({ length: BARS }).map((_, i) => {
        // middle columns move first, the edges a little later (overlapping action)
        const delay = (Math.abs(i - mid) / mid) * 0.11 + (i % 2) * 0.025;
        return (
          <motion.div
            key={i}
            className="relative h-full flex-1"
            style={{ background: "var(--color-violet)" }}
            initial={{ y: "100%" }}
            animate={{ y: ["100%", "0%", "0%", "-100%"] }}
            transition={{ duration: 0.85, times: [0, 0.42, 0.53, 1], delay, ease: [0.65, 0, 0.35, 1] }}
          >
            {/* the cherry tip, like the top of the small bars in the logo */}
            <span className="absolute inset-x-0 top-0 h-3" style={{ background: "var(--color-pink)" }} />
          </motion.div>
        );
      })}
    </div>
  );
}

// how long until the columns fully cover the screen (swap the page then)
export const WIPE_COVER_MS = 420;
