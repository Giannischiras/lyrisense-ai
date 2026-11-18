import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Lock, Loader2, ArrowRight } from "lucide-react";
import type { Provider } from "../api";
import { Wave } from "./Wave";

const PROVIDERS: { id: Provider; name: string; note: string; link: string }[] = [
  { id: "groq", name: "Groq", note: "free, very fast", link: "https://console.groq.com/keys" },
  { id: "gemini", name: "Gemini", note: "free tier", link: "https://aistudio.google.com/apikey" },
  { id: "anthropic", name: "Claude", note: "paid", link: "https://console.anthropic.com/settings/keys" },
  { id: "openai", name: "OpenAI", note: "paid", link: "https://platform.openai.com/api-keys" },
];

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
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-xl"
      >
        <Wave bars={36} className="mx-auto mb-8 h-16 w-72" />
        <h1 className="text-center font-display text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="gradient-text">Lyrisense</span>
        </h1>
        <p className="mt-3 text-center text-lg text-muted">
          Tell it how you feel. It finds the songs whose lyrics say it.
        </p>

        <form onSubmit={submit} className="glass mt-10 rounded-3xl p-6 sm:p-8">
          <p className="mb-3 text-sm font-medium text-muted">Pick the AI that runs the agent</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={`relative rounded-2xl border px-3 py-3 text-left transition-colors ${
                  provider === p.id ? "border-pink/70 bg-pink/10" : "border-line hover:border-muted/50"
                }`}
              >
                {provider === p.id && (
                  <motion.span
                    layoutId="provider-glow"
                    className="absolute inset-0 rounded-2xl ring-2 ring-pink/60"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="block font-display font-semibold">{p.name}</span>
                <span className="block text-xs text-muted">{p.note}</span>
              </button>
            ))}
          </div>

          <label className="mt-6 block text-sm font-medium text-muted" htmlFor="key">
            Your {chosen.name} API key{" "}
            <a href={chosen.link} target="_blank" rel="noreferrer" className="text-pink underline-offset-2 hover:underline">
              (get one)
            </a>
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-ink/60 px-4 focus-within:border-pink/60">
            <KeyRound className="h-4 w-4 shrink-0 text-muted" />
            <input
              id="key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="paste it here"
              className="w-full bg-transparent py-3 text-base outline-none placeholder:text-muted/60"
            />
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy || key.trim().length < 8}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet via-pink to-amber py-3.5 font-display text-lg font-semibold text-ink transition-opacity disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Start <ArrowRight className="h-5 w-5" /></>}
          </button>

          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Your key goes only to the Lyrisense backend running on this computer and stays in its memory
            for this session. It's never saved to disk, a database, logs or your browser.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
