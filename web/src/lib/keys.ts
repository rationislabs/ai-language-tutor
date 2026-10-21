/** The visitor's AI key: this tab only by default, or this device when they ask for it.
 * Never in IndexedDB, never in an export, never in an error message. */
const NAME = "tutor-ai-key";

export function loadKey(): string {
  return sessionStorage.getItem(NAME) ?? localStorage.getItem(NAME) ?? "";
}

export function saveKey(key: string, remember: boolean): void {
  forgetKey();
  (remember ? localStorage : sessionStorage).setItem(NAME, key);
}

export function forgetKey(): void {
  sessionStorage.removeItem(NAME);
  localStorage.removeItem(NAME);
}
