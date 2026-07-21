<script lang="ts">
  import SilhouetteCanvas from '$lib/components/SilhouetteCanvas.svelte';
  import MagicSlider from '$lib/components/MagicSlider.svelte';

  // Preview state
  let previewGarments = [
    { name: 'Blue Dress', url: './blue_gown_model.jpg', garment: './blue_gown.jpg' },
    { name: 'Kurti', url: './kurti_model.jpg', garment: './kurti.jpg' },
    { name: 'Red Saree', url: './red_saree_model.jpg', garment: './red_saree.jpg' }
  ];
  let selectedPreview = 1;

  // Base model in plain clothes
  const baseModel = './model.jpg';
</script>

<svelte:head>
  <title>StyleMirror — Virtual Try-On for E-Commerce</title>
  <meta name="description" content="See it on yourself before you buy. Virtual try-on powered by Qwen-Image-Edit." />
</svelte:head>

<!-- HERO -->
<section class="relative min-h-[90vh] flex items-center overflow-hidden">
  <!-- Background canvas for atmosphere -->
  <div class="absolute inset-0 h-full opacity-20 pointer-events-none">
    <SilhouetteCanvas />
  </div>

  <div class="relative max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center w-full">
    <div class="animate-fade-up">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-400/20 text-xs text-violet-300 mb-6">
        <span class="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
        BSc Thesis Project · Uttara University
      </div>
      <h1 class="font-display text-5xl md:text-7xl font-700 leading-[0.95] tracking-tight">
        See it<br />
        <span class="italic font-300 text-violet-300">on yourself</span><br />
        before you buy.
      </h1>
      <p class="mt-6 text-lg text-violet-300/60 max-w-md leading-relaxed">
        StyleMirror injects a virtual try-on experience into any partner e-commerce page. One click. No app install. No size guessing.
      </p>
      <div class="mt-8 flex gap-4">
        <a href="/demo" class="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold hover:shadow-lg hover:shadow-violet-500/30 transition-all">
          Try the Live Demo →
        </a>
        <a href="/dashboard" class="px-6 py-3 rounded-xl border border-white/10 hover:border-violet-400/50 transition-colors font-medium">
          Partner Dashboard
        </a>
      </div>
    </div>

    <!-- Live Preview Panel -->
    <div class="p-6 mirror-surface">
        <div class="text-center">
            <div class="text-xs text-violet-300/40 uppercase tracking-wider mb-4 flex items-center justify-center gap-2">
            <span>✨ Interactive Magic Preview</span>
            </div>

            <!-- Magic Slider Container -->
            <div class="relative aspect-[6/7] rounded-xl bg-ink-950/60 border border-white/5 overflow-hidden">
            <MagicSlider beforeSrc={baseModel} afterSrc={previewGarments[selectedPreview].url} />
            </div>

            <!-- Garment Selection Row -->
            <div class="mt-4 flex items-center justify-center gap-3">
            <span class="text-xs text-violet-300/40 mr-2">Select Garment:</span>
            {#each previewGarments as g, i}
                <button
                class="w-24 h-24 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 {selectedPreview === i ? 'border-violet-400 ring-2 ring-violet-400/30' : 'border-transparent'}"
                on:click={() => selectedPreview = i}
                aria-label="Select {g.name}"
                >
                <img src={g.garment} alt={g.name} class="w-full h-full object-cover" />
                </button>
            {/each}
            </div>

            <div class="mt-3 text-xs text-violet-300/40 pointer-events-none">
            Drag the slider to reveal the magic →
            </div>
        </div>
    </div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section class="py-24 px-6">
  <div class="max-w-5xl mx-auto">
    <h2 class="font-display text-4xl md:text-5xl font-700 text-center mb-4">
      Three pieces. <span class="italic font-300 text-violet-300">One mirror.</span>
    </h2>
    <p class="text-center text-violet-300/50 mb-16 max-w-xl mx-auto">
      A deliberately simple architecture: an injector, an API, and a frontend. No message brokers, no second language, no babysitting.
    </p>
    <div class="grid md:grid-cols-3 gap-6">
      {#each [
        { n: '01', title: 'Injector', desc: 'A Tampermonkey userscript with Shadow DOM. Auto-detects product images in demo mode; reads data-stylemirror tags in production.', icon: '💉' },
        { n: '02', title: 'API + Inference', desc: 'Go + chi. Validates, calls DashScope Qwen-Image-Edit synchronously over HTTPS, returns. Redis is a status store, not a queue.', icon: '⚙️' },
        { n: '03', title: 'Frontend', desc: 'SvelteKit + Tailwind. Landing page, embedded live demo, and a partner dashboard. Mirror-motif throughout.', icon: '✨' },
      ] as f}
        <div class="p-6 mirror-surface">
          <div class="text-3xl mb-4">{f.icon}</div>
          <div class="text-xs text-violet-400 font-mono mb-2">{f.n}</div>
          <h3 class="font-display text-xl font-700 mb-2">{f.title}</h3>
          <p class="text-sm text-violet-300/50 leading-relaxed">{f.desc}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- CTA -->
<section class="py-24 px-6">
  <div class="max-w-3xl mx-auto text-center">
    <h2 class="font-display text-4xl md:text-5xl font-700 mb-4">
      Try it <span class="italic font-300 text-violet-300">right now.</span>
    </h2>
    <p class="text-violet-300/50 mb-8">No install needed. Upload a photo, pick a garment, see yourself in it.</p>
    <a href="/demo" class="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-lg hover:shadow-2xl hover:shadow-violet-500/30 transition-all">
      Open Live Demo →
    </a>
  </div>
</section>

<footer class="py-12 px-6 border-t border-white/5 text-center text-sm text-violet-300/30">
  StyleMirror · Khaled · Uttara University
</footer>
