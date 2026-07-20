<script lang="ts">
  import { onMount } from 'svelte';
  import { getUsage, type Usage } from '$lib/api';
  import MirrorPanel from '$lib/components/MirrorPanel.svelte';

  let usage: Usage | null = null;
  let loading = true;

  onMount(async () => {
    try { usage = await getUsage(); } catch {} finally { loading = false; }
  });

  const sampleGarments = [
    { name: 'White Tee', url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400' },
    { name: 'Denim Jacket', url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400' },
    { name: 'Summer Dress', url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400' },
  ];
</script>

<svelte:head><title>Partner Dashboard — StyleMirror</title></svelte:head>

<section class="py-16 px-6">
  <div class="max-w-5xl mx-auto">
    <h1 class="font-display text-4xl font-700 mb-2">Partner Dashboard</h1>
    <p class="text-violet-300/50 mb-10">Monitor usage, manage integrations, and grab your embed snippet.</p>

    <!-- Usage -->
    <div class="grid md:grid-cols-3 gap-4 mb-10">
      <MirrorPanel class="p-6">
        <div class="text-xs uppercase tracking-wider text-violet-300/40 mb-2">Requests Used</div>
        {#if loading}<div class="h-8 w-16 skeleton rounded"></div>{:else}
        <div class="font-display text-3xl font-700">{usage?.used ?? 0} <span class="text-violet-300/30 text-lg">/ {usage?.limit ?? 20}</span></div>
        {/if}
      </MirrorPanel>
      <MirrorPanel class="p-6">
        <div class="text-xs uppercase tracking-wider text-violet-300/40 mb-2">Reset In</div>
        {#if loading}<div class="h-8 w-20 skeleton rounded"></div>{:else}
        <div class="font-display text-3xl font-700">{usage ? Math.max(0, Math.round((usage.reset_at_unix * 1000 - Date.now()) / 60000)) : 0}<span class="text-violet-300/30 text-lg"> min</span></div>
        {/if}
      </MirrorPanel>
      <MirrorPanel class="p-6">
        <div class="text-xs uppercase tracking-wider text-violet-300/40 mb-2">Client ID</div>
        <div class="font-mono text-xs text-violet-300/60 truncate">{usage?.client_id || '—'}</div>
      </MirrorPanel>
    </div>

    <!-- Embed snippet -->
    <MirrorPanel class="p-6 mb-10">
      <h2 class="font-display text-xl font-700 mb-4">Integration Snippet</h2>
      <p class="text-sm text-violet-300/50 mb-4">Add this attribute to any product image on your site to make it StyleMirror-enabled:</p>
      <pre class="bg-ink-950/80 rounded-xl p-4 text-xs text-violet-200 overflow-x-auto border border-white/5"><code>&lt;img src="/product.jpg"
     data-stylemirror="true"
     alt="Cotton Crew Neck Tee" /&gt;</code></pre>
      <p class="text-sm text-violet-300/50 mt-4">Then install the StyleMirror userscript in your browser, or load it as a partner script on your domain.</p>
    </MirrorPanel>

    <!-- Sample garments -->
    <MirrorPanel class="p-6">
      <h2 class="font-display text-xl font-700 mb-4">Sample Garment Library</h2>
      <div class="grid grid-cols-3 gap-3">
        {#each sampleGarments as g}
          <div class="aspect-square rounded-xl overflow-hidden border border-white/5">
            <img src={g.url} alt={g.name} class="w-full h-full object-cover" />
          </div>
        {/each}
      </div>
    </MirrorPanel>
  </div>
</section>
