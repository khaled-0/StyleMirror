<script lang="ts">
  import TryOnWidget from '$lib/components/TryOnWidget.svelte';
  import MirrorPanel from '$lib/components/MirrorPanel.svelte';
</script>

<svelte:head>
  <title>Live Demo — StyleMirror</title>
</svelte:head>

<section class="py-16 px-6">
  <div class="max-w-5xl mx-auto">
    <div class="text-center mb-12">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-400/20 text-xs text-violet-300 mb-4">
        Live Demo
      </div>
      <h1 class="font-display text-4xl md:text-5xl font-700 mb-3">
        Try it on, <span class="italic font-300 text-violet-300">right here.</span>
      </h1>
      <p class="text-violet-300/50 max-w-lg mx-auto">
        Upload a photo or use your webcam, pick a garment, and watch the try-on render in seconds. Your photo stays in your browser between try-ons.
      </p>
    </div>

    <MirrorPanel class="p-6 md:p-8">
      <TryOnWidget />
    </MirrorPanel>

    <div class="mt-8 text-center text-xs text-violet-300/30">
      Powered by DashScope Qwen-Image-Edit · Images are processed for generation and expire within minutes.
    </div>
  </div>
</section>
