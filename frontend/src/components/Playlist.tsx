import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Copy, Check, Music2, Quote, X, Loader2, ChevronDown, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlaylistResult } from "../api";
import { Wave } from "./Wave";

const GENRE_COLOR: Record<string, string> = {
  pop: "text-pink",
  rock: "text-violet",
  rap: "text-amber",
  rb: "text-sky-700",
  country: "text-emerald-700",
};

const ease = [0.22, 1, 0.36, 1] as const;
const spring = { type: "spring", stiffness: 420, damping: 30 } as const;

// overlapping action: each part of a row starts a little after the one before it,
// so the row "unfolds" instead of sliding in as one block
const row: Variants = {
  hidden: { opacity: 0 },
  show: (i: number) => ({
    opacity: 1,
    transition: { delayChildren: 0.45 + i * 0.07, staggerChildren: 0.05 },
  }),
};
const part: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease } },
};
const pop: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 500, damping: 18 } },
};

// no spotify login yet, so this opens spotify's search for the song (top result is
// almost always it). once we have the login we can link the exact track
const songLine = (s: { title: string; artist: string; year?: number | null }) =>
  `${s.title} — ${s.artist}${s.year ? ` (${s.year})` : ""}`;

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
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  // songs that were there from the start get the big reveal; a replacement gets a flash
  const firstIds = useRef(new Set(result.songs.map((s) => s.song_id)));
  const [mounted, setMounted] = useState(false);
  const [removedAt, setRemovedAt] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // the whole list: title, numbered songs with the year, and a small signature
  function copy() {
    const text = result.songs.map((s, i) => `${i + 1}. ${songLine(s)}`).join("\n");
    navigator.clipboard.writeText(`${result.title}\n\n${text}\n\nfound with Lyrisense`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // just one song
  function copyOne(s: PlaylistResult["songs"][number]) {
    navigator.clipboard.writeText(songLine(s));
    setCopiedId(s.song_id);
    setTimeout(() => setCopiedId((id) => (id === s.song_id ? null : id)), 1500);
  }

  async function remove(id: number) {
    if (!onRemove || busy !== null) return;
    setRemovedAt(result.songs.findIndex((s) => s.song_id === id));
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
        {/* the sleeve drops in, then the record slides out of it and keeps spinning */}
        <div className="relative mr-5 h-16 w-16 shrink-0">
          <motion.div
            className="vinyl absolute inset-1 rounded-full"
            initial={{ x: 0, opacity: 0 }}
            animate={{ x: 22, opacity: 1, rotate: 360 }}
            transition={{
              x: { delay: 0.35, type: "spring", stiffness: 120, damping: 14 },
              opacity: { delay: 0.3, duration: 0.2 },
              rotate: { duration: 6, repeat: Infinity, ease: "linear" },
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: -24, rotate: -10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="cover relative flex h-16 w-16 items-end overflow-hidden rounded-xl p-2 shadow-lg shadow-fg/20"
          >
            <Wave bars={7} className="h-6 w-full opacity-70 mix-blend-overlay" />
          </motion.div>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-bold tracking-tight">
            {(result.title ?? "").split(" ").map((w, i) => (
              <motion.span
                key={i}
                className="mr-[0.28em] inline-block"
                initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.5, ease }}
              >
                {w}
              </motion.span>
            ))}
          </h2>
          <motion.p
            className="text-xs text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {result.songs.length} {result.songs.length === 1 ? "song" : "songs"}
          </motion.p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={copy}
            aria-label="Copy the whole list"
            title="Copy the whole list"
            className="cursor-pointer rounded-full p-2.5 text-muted transition-colors hover:bg-fg/5 hover:text-fg"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
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
        <AnimatePresence mode="popLayout">
          {result.songs.map((s, i) => {
            const isOpen = open === s.song_id;
            const fresh = mounted && !firstIds.current.has(s.song_id);
            return (
              <motion.li
                key={s.song_id}
                layout
                custom={fresh ? -6 : i}
                variants={row}
                initial="hidden"
                animate="show"
                whileHover={{ y: -2 }}
                exit={{ opacity: 0, x: 40, scale: 0.97, transition: { duration: 0.25 } }}
                // the rows under a removed song move up one after the other, not all at once
                transition={{ layout: { ...spring, delay: Math.max(0, i - removedAt) * 0.035 } }}
                className={`group relative rounded-xl transition-[background-color,box-shadow] duration-300 hover:bg-white/60 hover:shadow-[0_8px_24px_-14px_rgba(20,33,61,0.35)] ${fresh ? "fresh-flash" : ""}`}
              >
                <div
                  className={`flex items-center gap-3 px-2 py-2.5 transition-opacity ${busy === s.song_id ? "opacity-40" : ""}`}
                >
                  <motion.span
                    variants={part}
                    className="w-6 shrink-0 text-right font-mono text-xs text-muted/60 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-pink"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </motion.span>
                  <button
                    onClick={() => setOpen(isOpen ? null : s.song_id)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <motion.span variants={part} className="block truncate text-[15px] font-medium">
                        {s.title} <span className="font-normal text-muted">· {s.artist}</span>
                      </motion.span>
                      <motion.span variants={part} className="block truncate text-xs text-muted">
                        {s.reason}
                      </motion.span>
                    </span>
                    <motion.span
                      variants={part}
                      className={`hidden shrink-0 text-[11px] sm:block ${GENRE_COLOR[s.genre] ?? "text-muted"}`}
                    >
                      {s.genre}
                      {s.year ? ` · ${s.year}` : ""}
                    </motion.span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <button
                    onClick={() => copyOne(s)}
                    aria-label={`Copy ${s.title}`}
                    title="Copy this song"
                    className="shrink-0 cursor-pointer rounded-full p-1.5 text-muted opacity-0 transition-all hover:bg-fg/10 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    {copiedId === s.song_id ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <motion.a
                    variants={pop}
                    href={spotifyUrl(s.title, s.artist)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Play ${s.title} on Spotify`}
                    title="Play on Spotify"
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#1db954]/15 text-[#1db954] transition-[background-color,color,transform] delay-75 duration-300 group-hover:scale-110 hover:bg-[#1db954] hover:text-black"
                  >
                    <Play className="h-3.5 w-3.5 translate-x-[1px]" fill="currentColor" />
                  </motion.a>
                  {onRemove && (
                    <button
                      onClick={() => remove(s.song_id)}
                      disabled={busy !== null}
                      aria-label={`Replace ${s.title}`}
                      title="Not this one, find another"
                      className="shrink-0 cursor-pointer rounded-full p-1.5 text-muted opacity-0 transition-all hover:bg-fg/10 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-wait"
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
                        <p className="leading-relaxed text-fg/90">{s.reason}</p>
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
              className="cursor-pointer rounded-full border border-fg/10 px-3.5 py-1.5 text-xs text-muted transition-colors hover:border-pink/50 hover:bg-pink/10 hover:text-fg"
            >
              {q}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
