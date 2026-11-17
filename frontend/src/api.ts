// Talks to the local backend through the Vite proxy (/api -> localhost:8000).
// The session id and the API key live only in memory. Nothing goes to localStorage.

export type Provider = "groq" | "gemini" | "anthropic" | "openai";

export type Step = {
  step: "understand" | "retrieve" | "relax_filters" | "curate" | "check";
  ms: number;
  [key: string]: unknown;
};

export type Song = {
  song_id: number;
  title: string;
  artist: string;
  genre: string;
  year: number | null;
  reason: string;
  matched_lyrics: string;
};

export type PlaylistResult = {
  title: string | null;
  songs: Song[];
  request: Record<string, unknown> | null;
  steps: Step[];
};

async function check(r: Response) {
  if (!r.ok) {
    let msg = `${r.status}`;
    try {
      const body = await r.json();
      msg = body.detail ?? msg;
    } catch {
      /* not json */
    }
    throw new Error(msg);
  }
  return r;
}

export async function createSession(): Promise<string> {
  const r = await check(await fetch("/api/session", { method: "POST" }));
  return (await r.json()).session_id;
}

export async function setKey(sid: string, provider: Provider, value: string) {
  await check(
    await fetch("/api/session/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": sid },
      body: JSON.stringify({ name: provider, value }),
    }),
  );
}

export function endSession(sid: string) {
  // keepalive so it still goes out when the tab is closing
  fetch("/api/session", { method: "DELETE", headers: { "X-Session-Id": sid }, keepalive: true });
}

export async function streamPlaylist(
  sid: string,
  provider: Provider,
  message: string,
  onStep: (s: Step) => void,
): Promise<PlaylistResult> {
  const r = await check(
    await fetch("/api/agent/playlist/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": sid },
      body: JSON.stringify({ message, provider }),
    }),
  );
  const reader = r.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx).replace(/^data: /, "");
      buffer = buffer.slice(idx + 2);
      if (!chunk.trim()) continue;
      const ev = JSON.parse(chunk);
      if (ev.type === "step") onStep(ev as Step);
      else if (ev.type === "result") return ev as PlaylistResult;
      else if (ev.type === "error") throw new Error(ev.message);
    }
  }
  throw new Error("the stream ended without a result");
}
