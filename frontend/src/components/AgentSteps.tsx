import { AnimatePresence, motion } from "framer-motion";
import { Brain, Search, SlidersHorizontal, ListMusic, ShieldCheck, Loader2 } from "lucide-react";
import type { Step } from "../api";

const META: Record<Step["step"], { label: string; icon: typeof Brain }> = {
  understand: { label: "Understanding what you want", icon: Brain },
  retrieve: { label: "Searching 52k songs", icon: Search },
  relax_filters: { label: "Nothing matched, loosening filters", icon: SlidersHorizontal },
  curate: { label: "Picking songs and writing why", icon: ListMusic },
  check: { label: "Checking the picks", icon: ShieldCheck },
};

function detail(s: Step): string {
  switch (s.step) {
    case "understand": {
      const r = s.request as { search_query?: string; size?: number; exclude_artists?: string[] } | undefined;
      const skip = r?.exclude_artists?.length ? `, skip ${r.exclude_artists.join(", ")}` : "";
      return r ? `"${r.search_query}", ${r.size} songs${skip}` : "";
    }
    case "retrieve":
      return `${s.candidates} candidates`;
    case "curate":
      return `${s.picks} picks${(s.attempt as number) > 1 ? " (second try)" : ""}`;
    case "check": {
      const dropped = (s.dropped as unknown[])?.length ?? 0;
      return `${s.kept} kept${dropped ? `, ${dropped} dropped` : ""}`;
    }
    default:
      return "";
  }
}

export function AgentSteps({ steps, running }: { steps: Step[]; running: boolean }) {
  return (
    <div className="glass rounded-3xl p-5">
      <p className="mb-4 font-display text-sm font-semibold uppercase tracking-widest text-muted">What the agent did</p>
      <ol className="space-y-3">
        <AnimatePresence initial={false}>
          {steps.map((s, i) => {
            const m = META[s.step];
            const Icon = m?.icon ?? Brain;
            return (
              <motion.li
                key={`${s.step}-${i}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet/15 text-violet">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{m?.label ?? s.step}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">{(s.ms / 1000).toFixed(1)}s</span>
                  </div>
                  <p className="truncate text-xs text-muted">{detail(s)}</p>
                  {Array.isArray(s.llm_calls) &&
                    (s.llm_calls as { model: string; ms: number }[]).map((c, j) => (
                      <p key={j} className="truncate font-mono text-[10px] text-violet/80">
                        LLM {c.model} {(c.ms / 1000).toFixed(1)}s
                      </p>
                    ))}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {running && (
          <li className="flex items-center gap-3 text-sm text-muted">
            <span className="flex h-7 w-7 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-pink" />
            </span>
            working...
          </li>
        )}
      </ol>
    </div>
  );
}
