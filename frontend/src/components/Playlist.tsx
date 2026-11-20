import { AnimatePresence, motion } from "framer-motion";
import { Copy, Check, Music2, Quote, X, Loader2, ChevronDown, Play } from "lucide-react";
import { useState } from "react";
import type { PlaylistResult } from "../api";
import { Wave } from "./Wave";

const GENRE_COLOR: Record<string, string> = {
  pop: "text-pink",
  rock: "text-violet",
  rap: "text-amber",
  rb: "text-sky-300",
  country: "text-emerald-300",
};

const ease = [0.22, 1, 0.36, 1] as const;

// no spotify login yet, so this opens spotify's search for the song (top result is
// almost always it). once we have the login we can link the exact track
const spotifyUrl = (title: string, artist: string) =>
  `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`;

export function Playlist({
  result,
  onRemove,
  quick,
  onQuick,
}: {
  result: PlaylistResult;
  onRemove?: (songId: number) => Promise<void>;
  quick?: string[];
  onQuick?: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  function copy() {
    const text = result.songs.map((s, i) => `${i + 1}. ${s.title} - ${s.artist}`).join("\n");
    navigator.clipboard.writeText(`${result.title}\n\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function remove(id: number) {
    if (!onRemove || busy !== null) return;
    setBusy(id);
    try {
      await onRemove(id);
    } finally {
      setBusy(null);
    }
  }

  if (!result.songs.length) {
    return <p className="text-muted">No songs this time. Try describing it a bit differently.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <motion.div
          initial={{ opacity: 0, rotate: -8, scale: 0.8 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          transition={{ duration: 0.6, ease }}
          className="cover flex h-16 w-16 shrink-0 items-end overflow-hidden rounded-xl p-2"
        >
          <Wave bars={7} className="h-6 w-full opacity-70 mix-blend-overlay" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-bold tracking-tight">{result.title}</h2>
          <p className="text-xs text-muted">{result.songs.length} songs</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={copy}
            aria-label="Copy list"
            title="Copy list"
            className="cursor-pointer rounded-full p-2.5 text-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            disabled
            aria-label="Save to Spotify"
            title="Spotify login comes next"
            className="cursor-not-allowed rounded-full p-2.5 text-[#1db954] opacity-50"
          >
            <Music2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ol>
        <AnimatePresence initial={false} mode="popLayout">
          {result.songs.map((s, i) => {
            const isOpen = open === s.song_id;
            return (
              <motion.li
                key={s.song_id}
                layout
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: busy === s.song_id ? 0.4 : 1, x: 0 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.25 } }}
                transition={{ delay: i * 0.04, duration: 0.4, ease }}
                className="group rounded-xl transition-colors hover:bg-white/[0.035]"
              >
                <div className="flex items-center gap-3 px-2 py-2.5">
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-muted/60 group-hover:text-pink">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <button
                    onClick={() => setOpen(isOpen ? null : s.song_id)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {s.title} <span className="font-normal text-muted">· {s.artist}</span>
                      </span>
                      <span className="block truncate text-xs text-muted">{s.reason}</span>
                    </span>
                    <span className={`hidden shrink-0 text-[11px] sm:block ${GENRE_COLOR[s.genre] ?? "text-muted"}`}>
                      {s.genre}
                      {s.year ? ` · ${s.year}` : ""}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <a
                    href={spotifyUrl(s.title, s.artist)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Play ${s.title} on Spotify`}
                    title="Play on Spotify"
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#1db954]/15 text-[#1db954] transition-all hover:scale-105 hover:bg-[#1db954] hover:text-black"
                  >
                    <Play className="h-3.5 w-3.5 translate-x-[1px]" fill="currentColor" />
                  </a>
                  {onRemove && (
                    <button
                      onClick={() => remove(s.song_id)}
                      disabled={busy !== null}
                      aria-label={`Replace ${s.title}`}
                      title="Not this one, find another"
                      className="shrink-0 cursor-pointer rounded-full p-1.5 text-muted opacity-0 transition-all hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-wait"
                    >
                      {busy === s.song_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 px-11 pb-3 text-sm">
                        <p className="leading-relaxed text-white/90">{s.reason}</p>
                        {s.matched_lyrics && (
                          <p className="flex gap-2 border-l-2 border-pink/50 pl-3 text-xs italic leading-relaxed text-muted">
                            <Quote className="mt-0.5 h-3 w-3 shrink-0 text-pink/70" />
                            {s.matched_lyrics}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      {quick && onQuick && (
        <div className="mt-4 flex flex-wrap gap-2">
          {quick.map((q, i) => (
            <motion.button
              key={q}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              onClick={() => onQuick(q)}
              className="cursor-pointer rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-muted transition-colors hover:border-pink/50 hover:bg-pink/10 hover:text-white"
            >
              {q}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
