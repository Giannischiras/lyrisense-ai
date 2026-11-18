import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, LogOut, Sparkles } from "lucide-react";
import {
  createSession,
  endSession,
  setKey,
  streamPlaylist,
  type PlaylistResult,
  type Provider,
  type Step,
  type Turn,
} from "./api";
import { Setup } from "./components/Setup";
import { Wave } from "./components/Wave";
import { AgentSteps } from "./components/AgentSteps";
import { Playlist } from "./components/Playlist";
import { Logs, type LogLine } from "./components/Logs";

const IDEAS = [
  "who are you?",
  "chill songs for a rainy afternoon, no Coldplay",
  "angry rock for the gym",
  "ελληνικά τραγούδια για καλοκαίρι και θάλασσα",
  "sad songs about missing someone far away",
];

// the chat lives only in this page's memory. closing the tab forgets it
type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; text: string }
  | { id: number; role: "assistant"; playlist: PlaylistResult };

// what we send back as context. for a playlist, just the title and the songs
function toTurn(m: Message): Turn {
  if (m.role === "user") return { role: "user", content: m.text };
  if ("text" in m) return { role: "assistant", content: m.text };
  const songs = m.playlist.songs.map((s) => `${s.title} - ${s.artist}`).join("; ");
  return { role: "assistant", content: `made a playlist "${m.playlist.title}": ${songs}`.slice(0, 1500) };
}

let nextId = 1;

export default function App() {
  const sid = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const addLog = (text: string, level: LogLine["level"] = "info") =>
    setLogs((prev) => [...prev, { t: performance.now(), level, text }]);

  useEffect(() => {
    const bye = () => sid.current && endSession(sid.current);
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, running]);

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
    setSteps([]);
  }

  async function ask(message: string) {
    message = message.trim();
    if (!sid.current || !provider || !message || running) return;
    const history = messages.slice(-10).map(toTurn);
    setMessages((prev) => [...prev, { id: nextId++, role: "user", text: message }]);
    setText("");
    setRunning(true);
    setError(null);
    setSteps([]);
    setLogs([{ t: performance.now(), level: "info", text: `POST /agent/playlist/stream provider=${provider}` }]);
    try {
      const r = await streamPlaylist(sid.current, provider, message, history, (s) => {
        setSteps((prev) => [...prev, s]);
        const { step, ms, ...rest } = s;
        addLog(`step ${step} (${ms} ms) ${JSON.stringify(rest)}`);
      });
      if (r.kind === "chat") {
        addLog(`reply (${r.reply?.length ?? 0} chars)`);
        setMessages((prev) => [...prev, { id: nextId++, role: "assistant", text: r.reply || "..." }]);
      } else {
        addLog(`result: "${r.title}" with ${r.songs.length} songs`);
        setMessages((prev) => [...prev, { id: nextId++, role: "assistant", playlist: r }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`error: ${msg}`, "error");
      if (msg.includes("expired")) logout();
      setError(msg);
    } finally {
      setRunning(false);
    }
  }

  if (!provider) {
    return (
      <div className="glow-bg min-h-full">
        <Setup onConnect={connect} />
      </div>
    );
  }

  const started = messages.length > 0;

  const form = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        ask(text);
      }}
      className="glass mx-auto flex w-full max-w-3xl items-end gap-3 rounded-3xl p-3 pl-5"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            ask(text);
          }
        }}
        rows={1}
        maxLength={500}
        placeholder={started ? "say something, or ask for more songs..." : "describe a mood, a moment, a memory..."}
        className="max-h-40 min-h-[2.75rem] flex-1 resize-none bg-transparent py-2.5 text-base outline-none placeholder:text-muted/60"
      />
      <button
        type="submit"
        disabled={running || !text.trim()}
        aria-label="Send"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet via-pink to-amber text-ink transition-opacity disabled:opacity-40"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </form>
  );

  return (
    <div className="glow-bg min-h-full">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <Wave bars={8} active={running} className="h-6 w-10" />
          <span className="font-display text-xl font-bold gradient-text">Lyrisense</span>
        </div>
        <button onClick={logout} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-white">
          <LogOut className="h-3.5 w-3.5" /> forget key
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        {!started ? (
          <div className="pt-[12vh]">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 text-center font-display text-4xl font-bold tracking-tight sm:text-5xl"
            >
              How are you feeling?
            </motion.h1>
            {form}
            <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
              {IDEAS.map((idea, i) => (
                <motion.button
                  key={idea}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  onClick={() => ask(idea)}
                  className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm text-muted hover:border-pink/50 hover:text-white"
                >
                  <Sparkles className="h-3.5 w-3.5" /> {idea}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="order-2 min-w-0 lg:order-1">
              <div className="space-y-6 pb-4">
                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                    >
                      {m.role === "user" ? (
                        <p className="max-w-[80%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-gradient-to-br from-violet/80 to-pink/80 px-4 py-2.5 text-white">
                          {m.text}
                        </p>
                      ) : "text" in m ? (
                        <div className="flex max-w-[85%] items-start gap-3">
                          <Wave bars={5} active={false} className="mt-1 h-5 w-6 shrink-0" />
                          <p className="glass whitespace-pre-wrap rounded-3xl rounded-bl-lg px-4 py-2.5">{m.text}</p>
                        </div>
                      ) : (
                        <div className="w-full">
                          <Playlist result={m.playlist} />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {running && (
                  <div className="flex items-center gap-3 text-muted">
                    <Wave bars={12} active className="h-6 w-16" />
                    <span className="text-sm">tuning in...</span>
                  </div>
                )}
                {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
                <div ref={bottom} />
              </div>
              <div className="sticky bottom-4 pt-2">{form}</div>
            </div>
            <div className="order-1 lg:order-2 lg:sticky lg:top-6 lg:self-start">
              <AgentSteps steps={steps} running={running} />
              <Logs lines={logs} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
