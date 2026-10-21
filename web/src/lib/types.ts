/** The content file one language ships (built by tools/, see tutortools/export.py). */
export type Lang = "de" | "hu" | "fr" | "it";
export type HelpLang = "en" | "de";

export const LANG_NAMES: Record<Lang, string> = {
  de: "German",
  hu: "Hungarian",
  fr: "French",
  it: "Italian",
};
export const SPEECH_TAG: Record<Lang | HelpLang | "en", string> = {
  de: "de-DE",
  hu: "hu-HU",
  fr: "fr-FR",
  it: "it-IT",
  en: "en-US",
};

export interface Sentence {
  text: string;
  picture: string;
  help: Record<HelpLang, string>;
  audio: string | null; // path under /audio/, or null: the device's voice reads it
}

export interface Story {
  id: string;
  level: string;
  title: string;
  sentences: Sentence[];
  new_words: string[];
  names: string[];
  generated?: boolean;
}

export interface Gap {
  lemma: string;
  story: string;
  text: string;
  blank: string;
  audio: string | null;
  sentence_id?: string;
  author?: string; // Tatoeba contributor of the sentence (CC BY 2.0 FR)
  recording?: string; // "user, licence" of an openly licensed recording
}

export interface Word {
  lemma: string;
  en: string;
  de: string;
  rank: number | null;
}

export interface Content {
  lang: Lang;
  stories: Story[];
  baseline_rank: number;
  words: Record<string, Word>;
  forms: Record<string, string>;
  gaps: Gap[];
  credits: string[];
}
