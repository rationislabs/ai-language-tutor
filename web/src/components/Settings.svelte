<script lang="ts">
  import { untrack } from "svelte";
  import { complete, MESSAGES, AiError, type AiSettings, type Provider } from "../lib/ai";
  import { forgetKey, loadKey, saveKey } from "../lib/keys";
  import type { LangSettings } from "../lib/store";
  import { LANG_NAMES, type Lang } from "../lib/types";

  let {
    lang,
    settings,
    ai,
    onSettings,
    onAi,
    onExport,
    onImport,
  }: {
    lang: Lang;
    settings: LangSettings;
    ai: Omit<AiSettings, "key">;
    onSettings: (s: LangSettings) => void;
    onAi: (a: Omit<AiSettings, "key">) => void;
    onExport: () => void;
    onImport: (file: File) => Promise<string>;
  } = $props();

  // editable copies; saved explicitly with Save
  let s = $state(untrack(() => ({ ...settings })));
  let a = $state(untrack(() => ({ ...ai })));
  let key = $state(loadKey());
  let remember = $state(!!localStorage.getItem("tutor-ai-key"));
  let status = $state("");

  function save() {
    onSettings({ ...s });
    onAi({ ...a });
    if (key) saveKey(key, remember);
    status = "Saved.";
  }

  async function test() {
    status = "Testing…";
    try {
      await complete({ ...a, key }, "Reply with the word OK.");
      status = "Connection works.";
    } catch (e) {
      status = e instanceof AiError ? e.message : MESSAGES.bad;
    }
  }

  function forget() {
    forgetKey();
    key = "";
    status = "Key forgotten on this device.";
  }

  const PROVIDERS: Record<Provider, string> = {
    openai: "OpenAI-compatible",
    anthropic: "Anthropic",
    gemini: "Google Gemini",
  };
</script>

<section class="card">
  <h2>{LANG_NAMES[lang]}</h2>
  <label>Explanations in
    <select bind:value={s.help}><option value="en">English</option><option value="de">German</option></select>
  </label>
  <label>Gap answers by
    <select bind:value={s.mode}><option value="type">typing</option><option value="choose">choosing from 4</option></select>
  </label>
  <label>Speed
    <select bind:value={s.speed}><option value={0.75}>0.75×</option><option value={1}>1×</option></select>
  </label>
</section>

<section class="card">
  <h2>Your own AI (optional)</h2>
  <p class="muted">Your key and the words you know go straight to your provider. Nothing passes through us.</p>
  <label>Provider
    <select bind:value={a.provider}>
      {#each Object.entries(PROVIDERS) as [value, name] (value)}<option {value}>{name}</option>{/each}
    </select>
  </label>
  {#if a.provider === "openai"}
    <label>Address <input bind:value={a.baseUrl} placeholder="https://api.openai.com/v1" /></label>
  {/if}
  <label>Model <input bind:value={a.model} placeholder="e.g. gpt-4o-mini, claude-haiku-4-5, gemini-2.5-flash" /></label>
  <label>Key <input type="password" bind:value={key} autocomplete="off" /></label>
  <label class="row"><input type="checkbox" bind:checked={remember} /> Remember on this device</label>
  <div class="row">
    <button class="primary" onclick={save}>Save</button>
    <button onclick={test} disabled={!key || !a.model}>Test connection</button>
    <button onclick={forget}>Forget key</button>
  </div>
  {#if status}<p aria-live="polite">{status}</p>{/if}
</section>

<section class="card">
  <h2>Progress</h2>
  <p class="muted">Move your progress between phone and laptop. The AI key is never included.</p>
  <div class="row">
    <button onclick={onExport}>Export</button>
    <label class="row">Import <input type="file" accept="application/json" onchange={async (e) => { const f = e.currentTarget.files?.[0]; if (f) status = await onImport(f); }} /></label>
  </div>
</section>
