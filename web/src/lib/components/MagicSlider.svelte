<script lang="ts">
    export let beforeSrc: string;
    export let afterSrc: string;

    let container: HTMLElement;
    let pos = 50;
    let dragging = false;

    function update(clientX: number) {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        pos = Math.max(
            0,
            Math.min(100, ((clientX - rect.left) / rect.width) * 100)
        );
    }

    function onKey(e: KeyboardEvent) {
        if (e.key === "ArrowLeft") pos = Math.max(0, pos - 2);
        if (e.key === "ArrowRight") pos = Math.min(100, pos + 2);
    }
</script>

<svelte:window
    on:mousemove={(e) => dragging && update(e.clientX)}
    on:mouseup={() => dragging = false}
/>

<div
    bind:this={container}
    class="relative w-full h-full overflow-hidden select-none cursor-ew-resize group rounded-2xl shadow-2xl shadow-violet-900/30"
    role="slider"
    aria-label="Magic Try-On Slider"
    aria-valuenow={Math.round(pos)}
    aria-valuemin={0}
    aria-valuemax={100}
    tabindex="0"
    on:keydown={onKey}
    on:mousedown={(e) => {
        dragging = true;
        update(e.clientX);
    }}
    on:touchstart={(e) => update(e.touches[0].clientX)}
    on:touchmove={(e) => {
        e.preventDefault();
        update(e.touches[0].clientX);
    }}
    style="touch-action: none;"
>
    <!-- Base Layer: After Image -->
    <img
        src={afterSrc}
        alt="After Try-On"
        class="absolute object-top inset-0 w-full h-full object-cover pointer-events-none"
        draggable="false"
    />

    <!-- Top Layer: Before Image (Clipped Instantly) -->
    <div
        class="absolute inset-0 w-full h-full pointer-events-none drop-shadow-[10px_0_25px_rgba(0,0,0,0.4)]"
        style="clip-path: inset(0 {100 - pos}% 0 0);"
    >
        <img
            src={beforeSrc}
            alt="Before Try-On"
            class="absolute object-top inset-0 w-full h-full object-cover"
            draggable="false"
        />
        <!-- Subtle distinction tint over the original image -->
        <div
            class="absolute inset-0 bg-gradient-to-tr from-violet-950/20 to-indigo-950/10 mix-blend-overlay"
        ></div>
    </div>

    <!-- Slider Track -->
    <div
        class="absolute top-0 bottom-0 w-1 pointer-events-none"
        style="left: {pos}%; transform: translateX(-50%);"
    >
        <!-- Glowing Line -->
        <div class="absolute inset-0 bg-white/90 shadow-[0_0_20px_rgba(167,139,250,0.8)] rounded-full"></div>

        <!-- Magical Knob -->
        <div
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
        >
            <!-- Pulsing Magic Aura -->
            <div class="absolute w-full h-full rounded-full bg-violet-500/40" class:animate-ping={pos >= 50}></div>

            <!-- Frosted Glass Knob -->
            <div class="relative w-full h-full rounded-full bg-white/10 backdrop-blur-xl border border-white/30 shadow-2xl flex items-center justify-center text-white">
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <!-- Double-sided arrows -->
                    <polyline points="9 6 3 12 9 18"></polyline>
                    <polyline points="15 6 21 12 15 18"></polyline>
                </svg>
            </div>
        </div>
    </div>

    <!-- Floating Glass Labels -->
    <span
        class="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/40 text-white/90 text-xs font-semibold backdrop-blur-md border border-white/10 transition-opacity duration-300"
        style="opacity: {pos > 15 ? 1 : 0};"
    >
        Before
    </span>
    <span
        class="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-violet-600/50 text-white text-xs font-semibold backdrop-blur-md border border-violet-300/30 transition-opacity duration-300"
        style="opacity: {pos < 85 ? 1 : 0};"
    >
        After ✨
    </span>
</div>
