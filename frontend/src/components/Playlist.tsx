import { motion } from "framer-motion";
import { Copy, Check, Music2, Quote } from "lucide-react";
import { useState } from "react";
import type { PlaylistResult } from "../api";

const GENRE_COLOR: Record<string, string> = {
  pop: "bg-pink/15 text-pink",
  rock: "bg-violet/15 text-violet",
  rap: "bg-amber/15 text-amber",
  rb: "bg-sky-400/15 text-sky-300",
  country: "bg-emerald-400/15 text-emerald-300",
};

export function Playlist({ result }: { result: PlaylistResult }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const text = result.songs.map((s, i) => `${i + 1}. ${s.title} - ${s.artist}`).join("\n");
    navigator.clipboard.writeText(`${result.title}\n\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!result.songs.length) {
    return (
      <div className="glass rounded-3xl p-8 text-center text-muted">
        No songs this time. Try describing it a bit differently.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{result.songs.length} songs</p>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{result.title}</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:border-muted/60"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy list"}
          </button>
          <button
            disabled
            title="Spotify login comes next"
            className="flex items-center gap-2 rounded-full bg-[#1db954] px-4 py-2 text-sm font-semibold text-ink opacity-50"
          >
            <Music2 className="h-4 w-4" /> Save to Spotify
          </button>
        </div>
      </div>

      <ol className="space-y-3">
        {result.songs.map((s, i) => (
          <motion.li
            key={s.song_id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -2 }}
            className="glass group rounded-2xl p-4 sm:p-5"
          >
            <div className="flex items-start gap-4">
              <span className="w-6 shrink-0 pt-1 text-right font-display text-lg font-semibold text-muted group-hover:gradient-text">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="font-display text-lg font-semibold leading-tight">{s.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${GENRE_COLOR[s.genre] ?? "bg-line text-muted"}`}>
                    {s.genre}
                  </span>
                  {s.year && <span className="text-xs text-muted">{s.year}</span>}
                </div>
                <p className="text-sm text-muted">{s.artist}</p>
                <p className="mt-2 text-sm leading-relaxed">{s.reason}</p>
                {s.matched_lyrics && (
                  <p className="mt-2 flex gap-2 text-xs italic leading-relaxed text-muted">
                    <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="line-clamp-2">{s.matched_lyrics}</span>
                  </p>
                )}
              </div>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
