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
} from "./api";
import { Setup } from "./components/Setup";
import { Wave } from "./components/Wave";
import { AgentSteps } from "./components/AgentSteps";
import { Playlist } from "./components/Playlist";
import { Logs, type LogLine } from "./components/Logs";

const IDEAS = [
  "chill songs for a rainy afternoon, no Coldplay",
  "angry rock for the gym",
  "90s r&b for a slow night in",
  "ελληνικά τραγούδια για καλοκαίρι και θάλασσα",
  "sad songs about missing someone far away",
];

export default function App() {
  const sid = useRef<string | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [text, setText] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlaylistResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const addLog = (text: string, level: LogLine["level"] = "info") =>
    setLogs((prev) => [...prev, { t: performance.now(), level, text }]);

  useEffect(() => {
    const bye = () => sid.current && endSession(sid.current);
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, []);

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
    setResult(null);
    setSteps([]);
  }

  async function ask(message: string) {
    if (!sid.current || !provider || !message.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setSteps([]);
    setLogs([{ t: performance.now(), level: "info", text: `POST /agent/playlist/stream provider=${provider}` }]);
    try {
      const r = await streamPlaylist(sid.current, provider, message.trim(), (s) => {
        setSteps((prev) => [...prev, s]);
        const { step, ms, ...rest } = s;
        addLog(`step ${step} (${ms} ms) ${JSON.stringify(rest)}`);
      });
      addLog(`result: "${r.title}" with ${r.songs.length} songs`);
      setResult(r);
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

  const started = running || result || steps.length > 0;

  return (
    <div className="glow-bg min-h-full">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <Wave bars={8} active={running} className="h-6 w-10" />
          <span className="font-display text-xl font-bold gradient-text">Wavelength</span>
        </div>
        <button onClick={logout} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-white">
          <LogOut className="h-3.5 w-3.5" /> forget key
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <motion.div layout transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className={started ? "pt-2" : "pt-[12vh]"}>
          {!started && (
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 text-center font-display text-4xl font-bold tracking-tight sm:text-5xl"
            >
              How are you feeling?
            </motion.h1>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(text);
            }}
            className="glass mx-auto flex max-w-3xl items-end gap-3 rounded-3xl p-3 pl-5"
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
              placeholder="describe a mood, a moment, a memory..."
              className="max-h-40 min-h-[2.75rem] flex-1 resize-none bg-transparent py-2.5 text-base outline-none placeholder:text-muted/60"
            />
            <button
              type="submit"
              disabled={running || !text.trim()}
              aria-label="Make playlist"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet via-pink to-amber text-ink transition-opacity disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </form>

          {!started && (
            <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
              {IDEAS.map((idea, i) => (
                <motion.button
                  key={idea}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  onClick={() => {
                    setText(idea);
                    ask(idea);
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm text-muted hover:border-pink/50 hover:text-white"
                >
                  <Sparkles className="h-3.5 w-3.5" /> {idea}
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>

        {error && <p className="mx-auto mt-6 max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}

        <AnimatePresence>
          {started && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]"
            >
              <div className="order-2 lg:order-1">
                {result ? (
                  <Playlist result={result} />
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center gap-6">
                    <Wave bars={40} active className="h-24 w-80" />
                    <p className="text-muted">tuning in...</p>
                  </div>
                )}
              </div>
              <div className="order-1 lg:order-2 lg:sticky lg:top-6 lg:self-start">
                <AgentSteps steps={steps} running={running} />
                <Logs lines={logs} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
