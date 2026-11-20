// calls the backend through the vite proxy (/api -> localhost:8000)
// session id and key are only in memory, nothing in localStorage

export type Provider = "groq" | "gemini" | "anthropic" | "openai";

export type Step = {
  step: "understand" | "retrieve" | "relax_filters" | "curate" | "check" | "search_raw";
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

export type Mood = "sad" | "angry" | "happy" | "chill" | "romantic" | "energetic" | "nostalgic" | "dark";

export type Turn = { role: "user" | "assistant"; content: string };

export type PlaylistResult = {
  kind: "chat" | "playlist";
  reply: string | null;
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
  // keepalive so it still gets sent when you close the tab
  fetch("/api/session", { method: "DELETE", headers: { "X-Session-Id": sid }, keepalive: true });
}

export async function streamPlaylist(
  sid: string,
  provider: Provider,
  message: string,
  history: Turn[],
  onStep: (s: Step) => void,
): Promise<PlaylistResult> {
  const r = await check(
    await fetch("/api/agent/playlist/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": sid },
      body: JSON.stringify({ message, provider, history }),
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

// the user removed a song, ask for the next best one (null if nothing is left)
export async function replaceSong(
  sid: string,
  provider: Provider,
  message: string,
  request: Record<string, unknown>,
  current: { song_id: number; artist: string }[],
  dropId: number,
): Promise<Song | null> {
  const r = await check(
    await fetch("/api/agent/replace", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": sid },
      body: JSON.stringify({ provider, message, request, current, drop_id: dropId }),
    }),
  );
  return (await r.json()).song;
}
