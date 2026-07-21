<script lang="ts">
  import TryOnWidget from '$lib/components/TryOnWidget.svelte';
</script>

<svelte:head>
  <title>Live Demo — StyleMirror</title>
</svelte:head>

<section class="py-16 px-6">
  <div class="max-w-5xl mx-auto">

    <div class="p-6 md:p-8">
      <TryOnWidget />
    </div>

    <div class="mt-8 text-center text-xs text-violet-300/30">
      Powered by StyleMirror
    </div>
  </div>
</section>
