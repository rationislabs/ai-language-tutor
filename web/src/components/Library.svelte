<script lang="ts">
  import type { Story } from "../lib/types";

  let {
    stories,
    done,
    streakDays,
    minutes,
    aiReady,
    aiBusy,
    aiNote,
    notice,
    onOpen,
    onGenerate,
  }: {
    stories: Story[];
    done: string[];
    streakDays: number;
    minutes: number;
    aiReady: boolean;
    aiBusy: boolean;
    aiNote: string;
    notice: string;
    onOpen: (s: Story) => void;
    onGenerate: () => void;
  } = $props();

  const next = $derived(stories.find((s) => !done.includes(s.id)));
</script>

{#if notice}<p class="card" aria-live="polite">{notice}</p>{/if}

<p class="muted">Streak: {streakDays} days · {Math.round(minutes)} minutes listened · {done.length}/{stories.length} stories</p>

{#if next}
  <section class="card">
    <p class="muted">Next story · {next.level}</p>
    <h2>{next.sentences[0]?.picture} {next.title}</h2>
    <button class="primary" onclick={() => onOpen(next)}>Start</button>
  </section>
{/if}

{#if aiReady}
  <div class="row">
    <button onclick={onGenerate} disabled={aiBusy}>{aiBusy ? "Writing a story…" : "✨ New story with your AI"}</button>
  </div>
  {#if aiNote}<p aria-live="polite">{aiNote}</p>{/if}
{/if}

<ul style="list-style: none; padding: 0">
  {#each stories as s (s.id)}
    <li>
      <button class="card" style="width: 100%; text-align: left" onclick={() => onOpen(s)}>
        {done.includes(s.id) ? "✓" : "○"} {s.title} <span class="muted">· {s.level}{s.generated ? " · AI" : ""}</span>
      </button>
    </li>
  {/each}
</ul>
