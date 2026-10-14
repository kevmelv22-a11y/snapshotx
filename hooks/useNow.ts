import { useEffect, useState } from 'react';

/** Current time as render-safe state (Date.now() during render is impure), refreshed every `intervalMs`. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}
