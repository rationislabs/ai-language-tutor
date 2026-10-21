/** Optional AI stories: the browser calls the visitor's own provider directly; nothing passes
 * through a server of ours. Three adapters: OpenAI-compatible, Anthropic, Gemini. */
import { fold, lemmaOf, tokens } from "./text";
import type { Content, HelpLang, Lang, Story } from "./types";
import { LANG_NAMES } from "./types";

export type Provider = "openai" | "anthropic" | "gemini";
export interface AiSettings {
  provider: Provider;
  baseUrl: string; // OpenAI-compatible only
  model: string;
  key: string;
}
export type Failure = "auth" | "rate" | "network" | "bad";

export class AiError extends Error {
  constructor(
    public kind: Failure,
    message: string,
  ) {
    super(message);
  }
}

export const MESSAGES: Record<Failure, string> = {
  auth: "Your AI provider rejected the key.",
  rate: "Your AI provider's rate limit was reached. Try again in a minute.",
  network: "Your AI provider could not be reached.",
  bad: "Your AI provider's answer could not be used. Try again.",
};
export const MAX_UNKNOWN = 0.15;

type Fetch = typeof fetch;

function request(s: AiSettings, prompt: string): [string, RequestInit, (j: any) => unknown] {
  const json = { "content-type": "application/json" };
  if (s.provider === "anthropic")
    return [
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          ...json,
          "x-api-key": s.key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: s.model,
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        }),
      },
      (j) => j?.content?.[0]?.text,
    ];
  if (s.provider === "gemini")
    return [
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent`,
      {
        method: "POST",
        headers: { ...json, "x-goog-api-key": s.key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
      (j) => j?.candidates?.[0]?.content?.parts?.[0]?.text,
    ];
  return [
    `${s.baseUrl.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: { ...json, authorization: `Bearer ${s.key}` },
      body: JSON.stringify({ model: s.model, messages: [{ role: "user", content: prompt }] }),
    },
    (j) => j?.choices?.[0]?.message?.content,
  ];
}

export async function complete(s: AiSettings, prompt: string, fetchFn: Fetch = fetch): Promise<string> {
  const [url, init, pick] = request(s, prompt);
  let r: Response;
  try {
    r = await fetchFn(url, init);
  } catch {
    throw new AiError("network", MESSAGES.network);
  }
  if (r.status === 401 || r.status === 403) throw new AiError("auth", MESSAGES.auth);
  if (r.status === 429) throw new AiError("rate", MESSAGES.rate);
  if (!r.ok) throw new AiError("bad", `${MESSAGES.bad} (HTTP ${r.status})`);
  const text = pick(await r.json().catch(() => null));
  if (typeof text !== "string" || !text.trim()) throw new AiError("bad", MESSAGES.bad);
  return text;
}

export interface StoryRequest {
  lang: Lang;
  level: string;
  help: HelpLang;
  known: string[]; // the learner's most frequent known lemmas
  fresh: string[]; // the next 4-6 words to introduce
}

export function storyPrompt(q: StoryRequest): string {
  const helpName = q.help === "de" ? "German" : "English";
  return [
    `Write a short story in ${LANG_NAMES[q.lang]} for a learner at level ${q.level}.`,
    `Use only these words (any grammatical form): ${q.known.join(", ")}.`,
    `Introduce exactly these new words, each at least twice: ${q.fresh.join(", ")}.`,
    "Use 6 to 10 short sentences that build a small scene with a clear meaning from context.",
    `For every sentence give a picture hint (one emoji) and a simple ${helpName} explanation.`,
    "Answer with JSON only, no other text:",
    `{"title": "...", "sentences": [{"text": "...", "picture": "🙂", "help": "..."}], "new_words": [${q.fresh.map((w) => JSON.stringify(w)).join(", ")}]}`,
  ].join("\n");
}

export interface Checked {
  story: Story;
  unknown: string[];
  share: number;
}

/** Parse and check an AI answer. Unknown = no known lemma for the form, and no known lemma is
 * its start, accents ignored (Hungarian and other languages add endings to a stem). */
export function parseStory(text: string, q: StoryRequest, content: Content, id: string): Checked {
  // models often wrap the JSON in prose or code fences: take the outermost object
  const body = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    throw new AiError("bad", MESSAGES.bad);
  }
  const sentences = Array.isArray(data?.sentences) ? data.sentences : [];
  if (typeof data?.title !== "string" || sentences.length < 4 || sentences.length > 12)
    throw new AiError("bad", MESSAGES.bad);
  const story: Story = {
    id,
    level: q.level,
    title: data.title,
    sentences: sentences.map((s: any) => {
      if (typeof s?.text !== "string") throw new AiError("bad", MESSAGES.bad);
      const help = typeof s.help === "string" ? s.help : "";
      return {
        text: s.text,
        picture: typeof s.picture === "string" ? s.picture : "💬",
        help: { en: q.help === "en" ? help : "", de: q.help === "de" ? help : "" },
        audio: null,
      };
    }),
    new_words: q.fresh,
    names: [],
    generated: true,
  };
  const known = new Set([...q.known, ...q.fresh]);
  const all = story.sentences.flatMap((s) => tokens(s.text));
  const unknown = all.filter((t) => {
    const lemma = lemmaOf(t, content.forms);
    if (lemma && known.has(lemma)) return false;
    const low = fold(t);
    return ![...known].some((k) => k.length >= 3 && low.startsWith(fold(k)));
  });
  return { story, unknown: [...new Set(unknown)], share: all.length ? unknown.length / all.length : 1 };
}

export async function generateStory(
  s: AiSettings,
  q: StoryRequest,
  content: Content,
  id: string,
  fetchFn: Fetch = fetch,
): Promise<{ story: Story; note?: string }> {
  let last: Checked | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    last = parseStory(await complete(s, storyPrompt(q), fetchFn), q, content, id);
    if (last.share <= MAX_UNKNOWN) return { story: last.story };
  }
  return { story: last!.story, note: `Uses ${last!.unknown.length} words above your level.` };
}
