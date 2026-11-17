import { useEffect, useRef, useState } from "react";
import { ChevronDown, Terminal } from "lucide-react";

export type LogLine = { t: number; level: "info" | "error"; text: string };

// shows everything the backend sent and the time since the request started
export function Logs({ lines }: { lines: LogLine[] }) {
  const [open, setOpen] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length]);
  const start = lines[0]?.t ?? 0;

  return (
    <div className="glass mt-4 rounded-3xl">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-widest text-muted">
          <Terminal className="h-4 w-4" /> Logs
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="max-h-72 overflow-y-auto px-5 pb-4 font-mono text-[11px] leading-relaxed">
          {lines.length === 0 && <p className="text-muted">nothing yet</p>}
          {lines.map((l, i) => (
            <div key={i} className={l.level === "error" ? "text-red-400" : "text-muted"}>
              <span className="text-violet/80">{((l.t - start) / 1000).toFixed(2).padStart(6, " ")}s</span>{" "}
              <span className="break-all whitespace-pre-wrap">{l.text}</span>
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
    </div>
  );
}
