import { AnimatePresence, motion } from "framer-motion";
import { Brain, Search, SlidersHorizontal, ListMusic, ShieldCheck, Loader2, RotateCcw } from "lucide-react";
import type { Step } from "../api";

const META: Record<Step["step"], { label: string; icon: typeof Brain }> = {
  understand: { label: "Understanding what you want", icon: Brain },
  retrieve: { label: "Searching 52k songs", icon: Search },
  relax_filters: { label: "Nothing matched, loosening filters", icon: SlidersHorizontal },
  curate: { label: "Picking songs and writing why", icon: ListMusic },
  check: { label: "Checking the picks", icon: ShieldCheck },
  search_raw: { label: "Nothing fit, searching with your own words", icon: RotateCcw },
};

function detail(s: Step): string {
  switch (s.step) {
    case "understand": {
      if (s.intent === "chat") return "just talking, answering directly";
      const r = s.request as { search_query?: string; size?: number; exclude_artists?: string[] } | undefined;
      const skip = r?.exclude_artists?.length ? `, skip ${r.exclude_artists.join(", ")}` : "";
      return r ? `"${r.search_query}", ${r.size} songs${skip}` : "";
    }
    case "retrieve":
      return `${s.candidates} candidates${s.query ? ` for "${s.query}"` : ""}`;
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
  const total = steps.reduce((t, s) => t + s.ms, 0);
  return (
    <div className="glass rounded-[24px] p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">What the agent did</p>
        {steps.length > 0 && <span className="font-mono text-xs text-muted">{(total / 1000).toFixed(1)}s</span>}
      </div>
      <ol className="relative space-y-4">
        {(steps.length > 1 || running) && (
          <span className="absolute bottom-3 left-[15px] top-3 w-px bg-gradient-to-b from-violet/60 via-pink/40 to-transparent" />
        )}
        <AnimatePresence initial={false}>
          {steps.map((s, i) => {
            const m = META[s.step];
            const Icon = m?.icon ?? Brain;
            return (
              <motion.li
                key={`${s.step}-${i}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35 }}
                className="relative flex items-start gap-3"
              >
                <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet/30 bg-gradient-to-br from-violet/30 to-pink/20 text-white">
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
                      <p key={j} className="truncate font-mono text-[10px] text-pink/80">
                        LLM {c.model} {(c.ms / 1000).toFixed(1)}s
                      </p>
                    ))}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {running && (
          <li className="relative flex items-center gap-3 text-sm text-muted">
            <span className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-xl bg-pink/30" />
              <Loader2 className="relative h-4 w-4 animate-spin text-pink" />
            </span>
            working...
          </li>
        )}
        {!running && steps.length === 0 && <li className="text-sm text-muted">nothing yet</li>}
      </ol>
    </div>
  );
}
