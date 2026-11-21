import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Lock, Loader2, ArrowRight, ArrowUpRight, Check, Eye, EyeOff } from "lucide-react";
import { ClaudeLogo, GeminiLogo, GroqLogo, OpenAILogo } from "./Logos";
import type { Provider } from "../api";
import { Wave } from "./Wave";

const PROVIDERS: { id: Provider; name: string; note: string; free: boolean; link: string; logo: typeof GroqLogo }[] = [
  { id: "groq", name: "Groq", note: "very fast", free: true, link: "https://console.groq.com/keys", logo: GroqLogo },
  { id: "gemini", name: "Gemini", note: "Google", free: true, link: "https://aistudio.google.com/apikey", logo: GeminiLogo },
  {
    id: "anthropic",
    name: "Claude",
    note: "Anthropic",
    free: false,
    link: "https://console.anthropic.com/settings/keys",
    logo: ClaudeLogo,
  },
  { id: "openai", name: "OpenAI", note: "GPT", free: false, link: "https://platform.openai.com/api-keys", logo: OpenAILogo },
];

const ease = [0.22, 1, 0.36, 1] as const;

export function Setup({ onConnect }: { onConnect: (p: Provider, key: string, from: { x: number; y: number }) => Promise<void> }) {
  const [provider, setProvider] = useState<Provider>("groq");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const chosen = PROVIDERS.find((p) => p.id === provider)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // the page change starts from the middle of this button
    const r = button.current?.getBoundingClientRect();
    const from = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 };
    try {
      await onConnect(provider, key.trim(), from);
      setKey(""); // stay "busy" until the page changes
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
          <StepTitle n={1}>Choose the AI that runs the agent</StepTitle>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {PROVIDERS.map((p) => {
              const on = provider === p.id;
              const Logo = p.logo;
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  aria-pressed={on}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative flex cursor-pointer flex-col items-center rounded-2xl px-2 pb-3 pt-4 text-center transition-colors duration-200 ${
                    on ? "bg-white/90" : "bg-fg/[0.025] hover:bg-white/60"
                  }`}
                >
                  {/* the selected frame slides between the cards */}
                  {on && (
                    <motion.span
                      layoutId="provider-frame"
                      className="absolute inset-0 rounded-2xl border-[1.5px] border-fg shadow-[0_8px_24px_-12px_rgba(20,33,61,0.45)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  {!on && <span className="absolute inset-0 rounded-2xl border border-fg/[0.08]" />}
                  {on && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-fg text-ink"
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                    </motion.span>
                  )}
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-fg/[0.06] bg-white shadow-sm">
                    <Logo className="h-6 w-6" />
                  </span>
                  <span className="mt-2.5 font-display text-sm font-bold">{p.name}</span>
                  <span className="text-[11px] text-muted">{p.note}</span>
                  <span
                    className={`mt-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      p.free ? "bg-emerald-600/10 text-emerald-800" : "bg-fg/[0.06] text-muted"
                    }`}
                  >
                    {p.free ? "free" : "paid"}
                  </span>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-7 flex items-center justify-between gap-3">
            <label htmlFor="key">
              <StepTitle n={2}>Paste your {chosen.name} API key</StepTitle>
            </label>
            <a
              href={chosen.link}
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-pink underline-offset-2 hover:underline"
            >
              get a key <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-fg/[0.1] bg-white/80 px-4 transition-all focus-within:border-fg/50 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(20,33,61,0.06)]">
            <KeyRound className="h-4 w-4 shrink-0 text-muted" />
            <input
              id="key"
              type={show ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                chosen.id === "groq" ? "gsk_..." : chosen.id === "anthropic" ? "sk-ant-..." : chosen.id === "openai" ? "sk-..." : "AIza..."
              }
              className="w-full bg-transparent py-3.5 font-mono text-sm outline-none placeholder:text-muted/50"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "hide key" : "show key"}
              className="cursor-pointer text-muted transition-colors hover:text-fg"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

          <button
            ref={button}
            type="submit"
            disabled={busy || key.trim().length < 8}
            className="btn-gradient mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-4 font-display text-base font-bold text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-25"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Start listening <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>

          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-fg/[0.035] px-4 py-3">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-fg shadow-sm">
              <Lock className="h-3 w-3" />
            </span>
            <p className="text-xs leading-relaxed text-muted">
              Your key goes only to the Lyrisense backend on this computer and lives in its memory for this session. Never saved to disk, a
              database, logs or your browser.
            </p>
          </div>
        </motion.form>
      </div>
    </div>
  );
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 text-sm font-semibold text-fg">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-fg font-display text-[11px] font-bold text-ink">{n}</span>
      {children}
    </span>
  );
}
