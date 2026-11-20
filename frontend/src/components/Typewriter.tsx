import { useEffect, useState } from "react";

// shows the reply word by word. `animate` is false for old messages
export function Typewriter({ text, animate }: { text: string; animate: boolean }) {
  const words = text.split(/(\s+)/);
  const [n, setN] = useState(animate ? 0 : words.length);
  useEffect(() => {
    if (n >= words.length) return;
    const t = setTimeout(() => setN((x) => x + 2), 28);
    return () => clearTimeout(t);
  }, [n, words.length]);
  return (
    <>
      {words.slice(0, n).join("")}
      {n < words.length && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-pink" />}
    </>
  );
}
