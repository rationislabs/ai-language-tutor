<script lang="ts">
  let { credits }: { credits: string[] } = $props();
</script>

<section class="card">
  <h2>How it works</h2>
  <p>Listen to a story you almost understand, then read along and tap any word. Meaning comes from context and repetition, the way a child learns. Gap exercises bring words back on a spaced-repetition schedule (FSRS).</p>
  <p><strong>Install it:</strong> add the app to your home screen. On iPhone, Safari deletes the data of sites you have not opened for 7 days unless the app is installed.</p>
</section>

<section class="card">
  <h2>Credits</h2>
  <ul>
    <li>Stories, glosses and explanations © Rationis Labs.</li>
    <li>Word frequencies: FrequencyWords by Hermit Dave (OpenSubtitles 2018), CC BY-SA 4.0; the word lists derived from them are CC BY-SA 4.0.</li>
    <li>Voices: Piper (Open Home Foundation). thorsten, anna, berta, imre: CC0. siwis (SIWIS French Speech Synthesis Database): CC BY 4.0. serena: CC BY 4.0. pierre (UPMC, upmc-pierre-data): CC BY-SA 4.0.</li>
    {#each credits as c (c)}<li>{c}</li>{/each}
  </ul>
  <p class="muted">Contact: <a href="https://github.com/rationislabs">github.com/rationislabs</a></p>
</section>
