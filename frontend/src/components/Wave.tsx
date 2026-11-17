import { motion } from "framer-motion";

// the equalizer bars. when `active` is true they move more (agent is working)
export function Wave({ bars = 28, active = false, className = "" }: { bars?: number; active?: boolean; className?: string }) {
  return (
    <div className={`flex items-end justify-center gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        const base = 0.25 + 0.5 * Math.abs(Math.sin(i * 0.7));
        return (
          <motion.span
            key={i}
            className="w-[4px] rounded-full"
            style={{
              background: "linear-gradient(to top, #8b5cf6, #f472b6, #fbbf24)",
              height: "100%",
              transformOrigin: "bottom",
            }}
            animate={{ scaleY: active ? [base, 1, base * 0.6, 0.9, base] : [base, base * 1.25, base] }}
            transition={{
              duration: active ? 0.9 + (i % 5) * 0.12 : 2.4 + (i % 7) * 0.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.04,
            }}
          />
        );
      })}
    </div>
  );
}
