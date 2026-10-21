/** The device's own voice for help text and AI stories (no audio files needed). */
import { SPEECH_TAG } from "./types";

export function hasVoice(lang: keyof typeof SPEECH_TAG): boolean {
  if (typeof speechSynthesis === "undefined") return false;
  const tag = SPEECH_TAG[lang].slice(0, 2);
  return speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith(tag));
}

/** Resolves when the device has finished speaking (at once when it cannot speak). */
export function speak(text: string, lang: keyof typeof SPEECH_TAG, rate = 1): Promise<void> {
  if (typeof speechSynthesis === "undefined") return Promise.resolve();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = SPEECH_TAG[lang];
  u.rate = rate;
  return new Promise((done) => {
    u.onend = u.onerror = () => done();
    speechSynthesis.speak(u);
  });
}
