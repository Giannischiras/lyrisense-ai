import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Lock, Loader2, ArrowRight, Zap, Sparkles, Bot, Brain } from "lucide-react";
import type { Provider } from "../api";
import { Wave } from "./Wave";

const PROVIDERS: { id: Provider; name: string; note: string; link: string; icon: typeof Zap }[] = [
  { id: "groq", name: "Groq", note: "free, very fast", link: "https://console.groq.com/keys", icon: Zap },
  { id: "gemini", name: "Gemini", note: "free tier", link: "https://aistudio.google.com/apikey", icon: Sparkles },
  { id: "anthropic", name: "Claude", note: "paid", link: "https://console.anthropic.com/settings/keys", icon: Brain },
  { id: "openai", name: "OpenAI", note: "paid", link: "https://platform.openai.com/api-keys", icon: Bot },
];

const ease = [0.22, 1, 0.36, 1] as const;

export function Setup({ onConnect }: { onConnect: (p: Provider, key: string) => Promise<void> }) {
  const [provider, setProvider] = useState<Provider>("groq");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = PROVIDERS.find((p) => p.id === provider)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConnect(provider, key.trim());
      setKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease }}>
          <Wave bars={40} className="mx-auto mb-8 h-20 w-80" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, delay: 0.1, ease }}
          className="text-center font-display text-5xl font-extrabold tracking-tight sm:text-7xl"
        >
          <span className="gradient-text shimmer">Lyrisense</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease }}
          className="mx-auto mt-4 max-w-md text-center text-lg leading-relaxed text-muted"
        >
          Tell it how you feel. It finds the songs whose lyrics say it.
        </motion.p>

        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease }}
          className="glass glow-border idle mt-10 rounded-[28px] p-6 sm:p-8"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Pick the AI that runs the agent</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PROVIDERS.map((p) => {
              const on = provider === p.id;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  aria-pressed={on}
                  className={`group cursor-pointer rounded-2xl border px-3 py-3.5 text-left transition-all duration-200 ${
                    on
                      ? "border-pink/60 bg-gradient-to-br from-violet/25 to-pink/15 shadow-[0_0_30px_-8px_rgba(255,154,139,0.6)]"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className={`mb-2 h-4 w-4 transition-colors ${on ? "text-pink" : "text-muted group-hover:text-white"}`} />
                  <span className="block font-display text-sm font-semibold">{p.name}</span>
                  <span className="block text-xs text-muted">{p.note}</span>
                </button>
              );
            })}
          </div>

          <label className="mt-7 block text-xs font-semibold uppercase tracking-[0.2em] text-muted" htmlFor="key">
            Your {chosen.name} API key{" "}
            <a href={chosen.link} target="_blank" rel="noreferrer" className="normal-case tracking-normal text-pink underline-offset-2 hover:underline">
              (get one)
            </a>
          </label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/30 px-4 transition-colors focus-within:border-pink/60 focus-within:bg-black/40">
            <KeyRound className="h-4 w-4 shrink-0 text-muted" />
            <input
              id="key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="paste it here"
              className="w-full bg-transparent py-3.5 text-base outline-none placeholder:text-muted/50"
            />
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy || key.trim().length < 8}
            className="btn-gradient mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-4 font-display text-base font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Start listening <ArrowRight className="h-5 w-5" /></>}
          </button>

          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Your key goes only to the Lyrisense backend running on this computer and stays in its memory
            for this session. It's never saved to disk, a database, logs or your browser.
          </p>
        </motion.form>
      </div>
    </div>
  );
}
