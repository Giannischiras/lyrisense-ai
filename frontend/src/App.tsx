import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  | ({ id: number; role: "assistant"; playlist: PlaylistResult; ask: string } & Trace);

// what we send back as context. for a playlist, just the title and the songs
function toTurn(m: Message): Turn {
  if (m.role === "user") return { role: "user", content: m.text };
  if ("text" in m) return { role: "assistant", content: m.text };
  const songs = m.playlist.songs.map((s) => `${s.title} - ${s.artist}`).join("; ");
  return { role: "assistant", content: `made a playlist "${m.playlist.title}": ${songs}`.slice(0, 1500) };
}

let nextId = 1;
const ease = [0.22, 1, 0.36, 1] as const;

export default function App() {
  const sid = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [live, setLive] = useState<Trace>({ steps: [], logs: [] });
  const [running, setRunning] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [traceOf, setTraceOf] = useState<number | null>(null);

  useEffect(() => {
    const bye = () => sid.current && endSession(sid.current);
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, running]);

  async function connect(p: Provider, key: string) {
    const id = await createSession();
    await setKey(id, p, key);
    sid.current = id;
    setProvider(p);
  }

  function logout() {
    if (sid.current) endSession(sid.current);
    sid.current = null;
    setProvider(null);
    setMessages([]);
    setMood(null);
  }

  // the bars move while you type and calm down 700ms after the last key
  function onType(value: string) {
    setText(value);
    setTyping(true);
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setTyping(false), 700);
  }

  async function ask(message: string) {
    message = message.trim();
    if (!sid.current || !provider || !message || running) return;
    const history = messages.slice(-10).map(toTurn);
    setMessages((prev) => [...prev, { id: nextId++, role: "user", text: message }]);
    setText("");
    setTyping(false);
    setRunning(true);
    setError(null);
    const t0 = performance.now();
    const trace: Trace = { steps: [], logs: [{ t: t0, level: "info", text: `POST /agent/playlist/stream provider=${provider}` }] };
    const log = (text: string, level: LogLine["level"] = "info") => trace.logs.push({ t: performance.now(), level, text });
    setLive({ ...trace });
    try {
      const r = await streamPlaylist(sid.current, provider, message, history, (s) => {
        trace.steps.push(s);
        const { step, ms, ...rest } = s;
        log(`step ${step} (${ms} ms) ${JSON.stringify(rest)}`);
        const m = (s.request as { mood?: Mood } | undefined)?.mood;
        if (s.step === "understand" && s.intent !== "chat" && m) setMood(m);
        setLive({ steps: [...trace.steps], logs: [...trace.logs] });
      });
      if (r.kind === "chat") {
        log(`reply (${r.reply?.length ?? 0} chars)`);
        setMessages((prev) => [...prev, { id: nextId++, role: "assistant", text: r.reply || "...", fresh: true, ...trace }]);
      } else {
        log(`result: "${r.title}" with ${r.songs.length} songs`);
        setMessages((prev) => [...prev, { id: nextId++, role: "assistant", playlist: r, ask: message, ...trace }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("expired")) logout();
      setError(msg);
    } finally {
      setRunning(false);
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

  if (!provider) {
    return (
      <div className="relative min-h-full">
        <Background />
        <Setup onConnect={connect} />
      </div>
    );
  }

  const started = messages.length > 0;
  const waveMode: WaveMode = running ? "active" : typing ? "typing" : "idle";
  const lastPlaylistId = [...messages].reverse().find((m) => "playlist" in m)?.id;
  const lastId = messages[messages.length - 1]?.id;
  const traced = messages.find((m) => m.id === traceOf);
  const liveStep = live.steps[live.steps.length - 1]?.step;

  const form = (
    <form
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
        placeholder={started ? "how do you feel now? or ask for more songs like these..." : "tell me how you feel and I'll find songs whose lyrics match it..."}
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
    </form>
  );

  return (
    <div className="relative min-h-full">
      <Background words={!started} mood={mood} />
      <div className="relative z-10 flex min-h-full flex-col">
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-2.5">
            <Wave bars={7} mode={waveMode} className="h-5 w-8" />
            <span className="font-display text-base font-bold gradient-text shimmer">Lyrisense</span>
          </div>
          <button
            onClick={logout}
            aria-label="Forget key"
            title="Forget key"
            className="cursor-pointer rounded-full p-2 text-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-6">
          {!started ? (
            <div className="pt-[12vh]">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease }}>
                <Wave bars={24} mode={waveMode} className="mx-auto mb-6 h-12 w-48" />
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, ease }}
                className="mb-3 text-center font-display text-4xl font-extrabold tracking-tight sm:text-6xl"
              >
                How are you <span className="gradient-text shimmer">feeling?</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-10 text-center text-muted">
                52,000 songs, searched by what their lyrics mean.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease }}>
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
                    className="group flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.08] px-3.5 py-1.5 text-sm text-muted transition-colors duration-200 hover:border-pink/50 hover:bg-pink/10 hover:text-white"
                  >
                    <Icon className="h-3.5 w-3.5 text-pink/70 group-hover:text-pink" /> {idea}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-7 pb-4 pt-2">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease }}
                    className={m.role === "user" ? "flex justify-end" : ""}
                  >
                    {m.role === "user" ? (
                      <p className="max-w-[80%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-white/[0.08] px-4 py-2.5">{m.text}</p>
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
              {running && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 text-sm text-muted">
                  <Wave bars={12} mode="active" className="h-5 w-16" />
                  <AnimatePresence mode="wait">
                    <motion.span key={liveStep ?? "start"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                      {liveStep ? `${STEP_LABEL[liveStep] ?? liveStep}...` : "tuning in..."}
                    </motion.span>
                  </AnimatePresence>
                </motion.div>
              )}
              {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
              <div ref={bottom} />
            </div>
          )}
        </main>

        {started && <div className="sticky bottom-0 z-20 px-4 pb-5 pt-2">{form}</div>}
      </div>

      <Drawer open={traced !== undefined && traced.role === "assistant"} onClose={() => setTraceOf(null)}>
        {traced && traced.role === "assistant" && (
          <>
            <AgentSteps steps={traced.steps} running={false} />
            <Logs lines={traced.logs} />
          </>
        )}
      </Drawer>
    </div>
  );
}
