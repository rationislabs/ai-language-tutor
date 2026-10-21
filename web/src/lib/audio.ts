/** Playing a sentence: its audio file when there is one, else the device's voice. */
import { speak } from "./speech";
import type { Lang } from "./types";

let current: HTMLAudioElement | null = null;

/** Resolves when the sentence has finished, or was stopped by the next one. */
export function play(path: string | null, text: string, lang: Lang, speed: number): Promise<void> {
  current?.pause();
  if (!path) return speak(text, lang, speed);
  const a = (current = new Audio(`${import.meta.env.BASE_URL}audio/${path}`));
  a.playbackRate = speed;
  return new Promise((done) => {
    a.addEventListener("ended", () => done());
    a.addEventListener("pause", () => done());
    const fallback = () => void speak(text, lang, speed).then(done);
    try {
      void a.play()?.catch(fallback);
    } catch {
      fallback(); // e.g. a test DOM without media support
    }
  });
}

/** Fetch a story's audio ahead of time so it is cached for offline listening. */
export function prefetch(paths: (string | null)[]): void {
  for (const p of paths) if (p) fetch(`${import.meta.env.BASE_URL}audio/${p}`).catch(() => undefined);
}
