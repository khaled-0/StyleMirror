<script lang="ts">
  export let beforeSrc: string;
  export let afterSrc: string;
  export let beforeLabel = 'Before';
  export let afterLabel = 'After';

  let container: HTMLElement;
  let pos = 50;
  let dragging = false;

  function update(clientX: number) {
    const rect = container.getBoundingClientRect();
    pos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') pos = Math.max(0, pos - 3);
    if (e.key === 'ArrowRight') pos = Math.min(100, pos + 3);
  }
</script>

<div
  bind:this={container}
  class="relative w-full overflow-hidden rounded-2xl select-none cursor-ew-resize aspect-[3/4]"
  role="slider"
  aria-label="Before and after comparison. Use arrow keys to adjust."
  aria-valuenow={Math.round(pos)}
  aria-valuemin={0}
  aria-valuemax={100}
  tabindex="0"
  on:keydown={onKey}
  on:mousedown={(e) => { dragging = true; update(e.clientX); }}
  on:mousemove={(e) => { if (dragging) update(e.clientX); }}
  on:mouseup={() => { dragging = false; }}
  on:mouseleave={() => { dragging = false; }}
  on:touchstart={(e) => update(e.touches[0].clientX)}
  on:touchmove={(e) => { e.preventDefault(); update(e.touches[0].clientX); }}
  style="touch-action: none;"
>
  <img src={beforeSrc} alt={beforeLabel} class="absolute inset-0 w-full h-full object-cover pointer-events-none" />
  <img
    src={afterSrc}
    alt={afterLabel}
    class="absolute inset-0 w-full h-full object-cover pointer-events-none"
    style="clip-path: inset(0 0 0 {pos}%);"
  />
  <div class="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none" style="left: {pos}%; transform: translateX(-50%);">
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 flex items-center justify-center text-ink-900 shadow-xl">
      ⇆
    </div>
  </div>
  <span class="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-semibold uppercase tracking-wider pointer-events-none">{beforeLabel}</span>
  <span class="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-semibold uppercase tracking-wider pointer-events-none">{afterLabel}</span>
</div>
