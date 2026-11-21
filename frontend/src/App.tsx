import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ArrowUp, LogOut, CloudRain, Flame, Waves, HeartCrack, MessageCircle, Route } from "lucide-react";
import {
  createSession,
  endSession,
  replaceSong,
  setKey,
  streamPlaylist,
  type Mood,
  type PlaylistResult,
  type Provider,
  type Step,
  type Turn,
} from "./api";
import { Setup } from "./components/Setup";
import { Wave, type WaveMode } from "./components/Wave";
import { EqualizerWipe, WIPE_COVER_MS } from "./components/EqualizerWipe";
import { CircleReveal, REVEAL_COVER_MS, type RevealFrom } from "./components/CircleReveal";
import { AgentSteps } from "./components/AgentSteps";
import { Playlist } from "./components/Playlist";
import { Logs, type LogLine } from "./components/Logs";
import { Background } from "./components/Background";
import { Drawer } from "./components/Drawer";
import { Typewriter } from "./components/Typewriter";

const IDEAS = [
  { text: "who are you?", icon: MessageCircle },
  { text: "chill songs for a rainy afternoon, no Coldplay", icon: CloudRain },
  { text: "angry rock for the gym", icon: Flame },
  { text: "ελληνικά τραγούδια για καλοκαίρι και θάλασσα", icon: Waves },
  { text: "sad songs about missing someone far away", icon: HeartCrack },
];

// follow ups you can tap under the last playlist. they go through the chat history
const QUICK = ["happier", "sadder", "only Greek songs", "no rap", "5 more like these"];

const STEP_LABEL: Record<string, string> = {
  understand: "understanding",
  retrieve: "searching 52k songs",
  relax_filters: "loosening filters",
  curate: "picking songs",
  check: "checking the picks",
  search_raw: "trying again with your words",
};

type Trace = { steps: Step[]; logs: LogLine[] };

// the chat lives only in this page's memory. closing the tab forgets it
type Message =
  | { id: number; role: "user"; text: string }
  | ({ id: number; role: "assistant"; text: string; fresh: boolean } & Trace)
  | ({
      id: number;
      role: "assistant";
      playlist: PlaylistResult;
      ask: string;
    } & Trace);

// what we send back as context. for a playlist, just the title and the songs
function toTurn(m: Message): Turn {
  if (m.role === "user") return { role: "user", content: m.text };
  if ("text" in m) return { role: "assistant", content: m.text };
  const songs = m.playlist.songs.map((s) => `${s.title} - ${s.artist}`).join("; ");
  return {
    role: "assistant",
    content: `made a playlist "${m.playlist.title}": ${songs}`.slice(0, 1500),
  };
}

let nextId = 1;
const ease = [0.22, 1, 0.36, 1] as const;

export default function App() {
  const sid = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [live, setLive] = useState<Trace>({ steps: [], logs: [] });
  const [running, setRunning] = useState(false);
  const [kick, setKick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [traceOf, setTraceOf] = useState<number | null>(null);
  const formCtl = useAnimationControls();
  const [wipe, setWipe] = useState(0);
  const [reveal, setReveal] = useState<RevealFrom | null>(null);
  // bumps when you go home, so an answer that arrives after that is dropped
  const convo = useRef(0);

  useEffect(() => {
    const bye = () => sid.current && endSession(sid.current);
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, running]);

  // the key worked: a circle grows from the button, the app appears behind it
  async function connect(p: Provider, key: string, from: { x: number; y: number }) {
    const id = await createSession();
    await setKey(id, p, key);
    sid.current = id;
    setReveal({ ...from, id: Date.now() });
    window.setTimeout(() => setProvider(p), REVEAL_COVER_MS);
  }

  function logout() {
    if (sid.current) endSession(sid.current);
    sid.current = null;
    setProvider(null);
    setMessages([]);
    setMood(null);
  }

  // logo -> start page. the equalizer columns cover the screen, the chat is cleared behind
  // them, then they reveal the start page. the key and the session stay
  function goHome() {
    if (messages.length === 0 && !running) return;
    setWipe((w) => w + 1);
    window.setTimeout(() => {
      convo.current += 1;
      setMessages([]);
      setMood(null);
      setError(null);
      setRunning(false);
      setText("");
      setTraceOf(null);
      window.scrollTo({ top: 0 });
    }, WIPE_COVER_MS);
  }

  // every key press makes one bar of the wave jump
  function onType(value: string) {
    // a key that added or removed text makes one random bar jump
    if (value !== text) setKick((k) => k + 1);
    setText(value);
  }

  async function ask(message: string) {
    message = message.trim();
    if (!sid.current || !provider || !message || running) return;
    const history = messages.slice(-10).map(toTurn);
    setMessages((prev) => [...prev, { id: nextId++, role: "user", text: message }]);
    // the input squashes a little as if it pushed the message up
    formCtl.start({
      scaleX: [1, 1.025, 0.995, 1],
      scaleY: [1, 0.9, 1.03, 1],
      transition: { duration: 0.45, ease: "easeOut" },
    });
    setText("");
    setRunning(true);
    setError(null);
    const mine = convo.current;
    const t0 = performance.now();
    const trace: Trace = {
      steps: [],
      logs: [
        {
          t: t0,
          level: "info",
          text: `POST /agent/playlist/stream provider=${provider}`,
        },
      ],
    };
    const log = (text: string, level: LogLine["level"] = "info") => trace.logs.push({ t: performance.now(), level, text });
    setLive({ ...trace });
    try {
      const r = await streamPlaylist(sid.current, provider, message, history, (s) => {
        trace.steps.push(s);
        const { step, ms, ...rest } = s;
        log(`step ${step} (${ms} ms) ${JSON.stringify(rest)}`);
        if (convo.current !== mine) return;
        const m = (s.request as { mood?: Mood } | undefined)?.mood;
        if (s.step === "understand" && s.intent !== "chat" && m) setMood(m);
        setLive({ steps: [...trace.steps], logs: [...trace.logs] });
      });
      if (convo.current !== mine) return; // they went home while it was running
      if (r.kind === "chat") {
        log(`reply (${r.reply?.length ?? 0} chars)`);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId++,
            role: "assistant",
            text: r.reply || "...",
            fresh: true,
            ...trace,
          },
        ]);
      } else {
        log(`result: "${r.title}" with ${r.songs.length} songs`);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId++,
            role: "assistant",
            playlist: r,
            ask: message,
            ...trace,
          },
        ]);
      }
    } catch (e) {
      if (convo.current !== mine) return;
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("expired")) logout();
      setError(msg);
    } finally {
      if (convo.current === mine) setRunning(false);
    }
  }

  // ✕ on a song: ask the backend for the next best match and put it in the same spot
  async function removeSong(msgId: number, songId: number) {
    const m = messages.find((x) => x.id === msgId);
    if (!sid.current || !provider || !m || !("playlist" in m) || !m.playlist.request) return;
    const songs = m.playlist.songs;
    try {
      const next = await replaceSong(
        sid.current,
        provider,
        m.ask,
        m.playlist.request,
        songs.map((s) => ({ song_id: s.song_id, artist: s.artist })),
        songId,
      );
      const updated = next ? songs.map((s) => (s.song_id === songId ? next : s)) : songs.filter((s) => s.song_id !== songId);
      setMessages((prev) =>
        prev.map((x) => (x.id === msgId && "playlist" in x ? { ...x, playlist: { ...x.playlist, songs: updated } } : x)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // the overlay stays the second child in both pages, so react keeps it (and its
  // animation) alive while the page under it changes
  if (!provider) {
    return (
      <>
        <div className="relative min-h-full">
          <Background />
          <Setup onConnect={connect} />
        </div>
        <CircleReveal from={reveal} />
      </>
    );
  }

  const started = messages.length > 0;
  // typing doesn't move all the bars anymore, each key press kicks one (see `kick`)
  const waveMode: WaveMode = running ? "active" : "idle";
  const lastPlaylistId = [...messages].reverse().find((m) => "playlist" in m)?.id;
  // short lines from the lyrics of the last playlist, they float behind the chat
  const lastPlaylist = [...messages].reverse().find((m) => "playlist" in m);
  const lyricLines = lastPlaylist && "playlist" in lastPlaylist ? lyricBits(lastPlaylist.playlist.songs) : [];
  const lastId = messages[messages.length - 1]?.id;
  const traced = messages.find((m) => m.id === traceOf);
  const liveStep = live.steps[live.steps.length - 1]?.step;

  const form = (
    <motion.form
      layoutId="composer"
      transition={{ layout: { type: "spring", stiffness: 260, damping: 30 } }}
      animate={formCtl}
      onSubmit={(e) => {
        e.preventDefault();
        ask(text);
      }}
      className={`glass glow-border ${running ? "" : "idle"} mx-auto flex w-full max-w-2xl items-end gap-3 rounded-[26px] p-2 pl-5`}
    >
      <textarea
        value={text}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            ask(text);
          }
        }}
        rows={1}
        maxLength={500}
        aria-label="Message"
        placeholder={
          started
            ? "how do you feel now? or ask for more songs like these..."
            : "tell me how you feel and I'll find songs whose lyrics match it..."
        }
        className="max-h-40 min-h-[2.75rem] flex-1 resize-none bg-transparent py-2.5 text-base placeholder:text-muted/50"
      />
      <motion.button
        whileTap={{ scale: 0.9 }}
        type="submit"
        disabled={running || !text.trim()}
        aria-label="Send"
        className="btn-gradient flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl text-ink disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
      </motion.button>
    </motion.form>
  );

  return (
    <>
      <div className="relative min-h-full">
        <Background words={!started} lyrics={lyricLines} mood={mood} running={running} kick={kick} />
        <div className="relative z-10 flex min-h-full flex-col">
          <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5">
            <motion.button
              onClick={goHome}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              aria-label="Lyrisense, back to the start"
              title="Back to the start"
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-1 py-0.5"
            >
              <Wave bars={7} mode={waveMode} kick={kick} className="h-5 w-8" />
              <span className="font-display text-base font-bold gradient-text shimmer">Lyrisense</span>
            </motion.button>
            <button
              onClick={logout}
              aria-label="Forget key"
              title="Forget key"
              className="cursor-pointer rounded-full p-2 text-muted transition-colors hover:bg-fg/5 hover:text-fg"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </header>

          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-6">
            <AnimatePresence mode="popLayout" initial={false}>
              {!started ? (
                <motion.div
                  key="hero"
                  className="pt-[12vh]"
                  // the start page lifts away and blurs while the input travels down
                  exit={{
                    opacity: 0,
                    y: -70,
                    scale: 0.96,
                    filter: "blur(10px)",
                    transition: { duration: 0.5, ease },
                  }}
                >
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease }}>
                    <Wave bars={24} mode={waveMode} kick={kick} className="mx-auto mb-6 h-12 w-48" />
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.8, ease }}
                    className="mb-3 text-center font-display text-4xl font-extrabold tracking-tight sm:text-6xl"
                  >
                    How are you <span className="gradient-text shimmer">feeling?</span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mb-10 text-center text-muted"
                  >
                    52,000 songs, searched by what their lyrics mean.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.15, ease }}
                  >
                    {form}
                  </motion.div>
                  <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                    {IDEAS.map(({ text: idea, icon: Icon }, i) => (
                      <motion.button
                        key={idea}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.06, ease }}
                        onClick={() => ask(idea)}
                        className="group flex cursor-pointer items-center gap-2 rounded-full border border-fg/[0.08] px-3.5 py-1.5 text-sm text-muted transition-colors duration-200 hover:border-pink/50 hover:bg-pink/10 hover:text-fg"
                      >
                        <Icon className="h-3.5 w-3.5 text-pink/70 group-hover:text-pink" /> {idea}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="chat"
                  className="space-y-7 pb-4 pt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                >
                  <AnimatePresence initial={false}>
                    {messages.map((m) => (
                      <motion.div
                        key={m.id}
                        // your message flies up from the input and settles with a small bounce
                        initial={m.role === "user" ? { opacity: 0, y: 60, scale: 0.9 } : { opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={m.role === "user" ? { type: "spring", stiffness: 380, damping: 24 } : { duration: 0.4, ease }}
                        style={{ transformOrigin: "bottom right" }}
                        className={m.role === "user" ? "flex justify-end" : ""}
                      >
                        {m.role === "user" ? (
                          <p className="max-w-[80%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-fg/[0.08] px-4 py-2.5">{m.text}</p>
                        ) : (
                          <div>
                            {"text" in m ? (
                              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                                <Typewriter text={m.text} animate={m.fresh && m.id === lastId} />
                              </p>
                            ) : (
                              <Playlist
                                result={m.playlist}
                                onRemove={(songId) => removeSong(m.id, songId)}
                                quick={m.id === lastPlaylistId && m.id === lastId && !running ? QUICK : undefined}
                                onQuick={ask}
                              />
                            )}
                            <button
                              onClick={() => setTraceOf(m.id)}
                              className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-muted/70 transition-colors hover:text-pink"
                            >
                              <Route className="h-3.5 w-3.5" /> how I found {"text" in m ? "this" : "these"}
                            </button>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <AnimatePresence>
                    {running && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          scale: 0.95,
                          transition: { duration: 0.2 },
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 24,
                        }}
                        className="flex flex-col items-center gap-3 py-6 text-sm text-muted"
                      >
                        <Wave bars={22} mode="active" className="h-12 w-44" />
                        {/* the old step leaves while the new one comes in (they overlap) */}
                        <div className="relative h-5 w-full overflow-hidden text-center">
                          <AnimatePresence initial={false}>
                            <motion.span
                              key={liveStep ?? "start"}
                              className="absolute inset-x-0"
                              initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                              exit={{ opacity: 0, y: -14, filter: "blur(4px)" }}
                              transition={{ duration: 0.45, ease }}
                            >
                              {liveStep ? `${STEP_LABEL[liveStep] ?? liveStep}...` : "tuning in..."}
                            </motion.span>
                          </AnimatePresence>
                        </div>
                        <div className="flex gap-1.5">
                          {live.steps.map((_, i) => (
                            <motion.span
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-fg/40"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{
                                type: "spring",
                                stiffness: 600,
                                damping: 15,
                              }}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">{error}</p>}
                  <div ref={bottom} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {started && <div className="sticky bottom-0 z-20 px-4 pb-5 pt-2">{form}</div>}
        </div>

        <EqualizerWipe run={wipe} />

        <Drawer open={traced !== undefined && traced.role === "assistant"} onClose={() => setTraceOf(null)}>
          {traced && traced.role === "assistant" && (
            <>
              <AgentSteps steps={traced.steps} running={false} />
              <Logs lines={traced.logs} />
            </>
          )}
        </Drawer>
      </div>
      <CircleReveal from={reveal} />
    </>
  );
}

// cut the matched lyrics into short pieces (3-6 words) for the background
function lyricBits(songs: { matched_lyrics: string }[]): string[] {
  const out: string[] = [];
  for (const s of songs) {
    const parts = (s.matched_lyrics || "")
      .replace(/^.*?:\s/, "")
      .split(/[\n.,;!?…"«»]+/)
      .map((x) => x.trim())
      .filter((x) => x.split(/\s+/).length >= 2);
    for (const part of parts.slice(0, 2)) out.push(part.split(/\s+/).slice(0, 6).join(" ").toLowerCase());
    if (out.length >= 12) break;
  }
  return [...new Set(out)];
}
