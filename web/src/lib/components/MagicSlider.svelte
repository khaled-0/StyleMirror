<script lang="ts">
    import { onMount } from "svelte";

    export let beforeSrc: string;
    export let afterSrc: string;

    let container: HTMLElement;
    let pos = 50;
    let dragging = false;
    let sparkles = [];

    function update(clientX: number) {
        const rect = container.getBoundingClientRect();
        pos = Math.max(
            0,
            Math.min(100, ((clientX - rect.left) / rect.width) * 100),
        );
    }

    function onKey(e: KeyboardEvent) {
        if (e.key === "ArrowLeft") pos = Math.max(0, pos - 5);
        if (e.key === "ArrowRight") pos = Math.min(100, pos + 5);
    }
</script>

<div
    bind:this={container}
    class="relative w-full h-full overflow-hidden select-none cursor-ew-resize group"
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
    on:mousemove={(e) => {
        if (dragging) update(e.clientX);
    }}
    on:mouseup={() => {
        dragging = false;
    }}
    on:mouseleave={() => {
        dragging = false;
    }}
    on:touchstart={(e) => update(e.touches[0].clientX)}
    on:touchmove={(e) => {
        e.preventDefault();
        update(e.touches[0].clientX);
    }}
    style="touch-action: none;"
>
    <!-- After Image (Try-On Garment) -->
    <img
        src={afterSrc}
        alt="After"
        class="absolute object-top inset-0 w-full h-full object-cover"
    />

    <!-- Before Image (Regular Clothes) -->
    <div
        class="absolute inset-0 w-full h-full"
        style="mask-image: linear-gradient(90deg, black 0%, black calc({pos}% - 4%), transparent calc({pos}% + 4%)); -webkit-mask-image: linear-gradient(90deg, black 0%, black calc({pos}% - 4%), transparent calc({pos}% + 4%));"
    >
        <img
            src={beforeSrc}
            alt="Before"
            class="absolute object-top inset-0 w-full h-full object-cover"
        />
        <!-- Purple magic tint over the revealed image -->
        <div
            class="absolute inset-0 bg-gradient-to-tr from-violet-500/20 to-indigo-500/10 mix-blend-overlay"
        ></div>
    </div>

    <!-- Slider Handle & Sparkles -->
    <div
        class="absolute top-0 bottom-0 w-1 bg-white/80 shadow-[0_0_15px_rgba(167,139,250,0.8)]"
        style="left: {pos}%; transform: translateX(-50%);"
    >
        <!-- Knob -->
        <div
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-violet-600 shadow-xl transition-transform group-hover:scale-110"
        >
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <polyline points="15 18 9 12 15 6"></polyline>
                <polyline points="9 18 3 12 9 6" opacity="0.3"></polyline>
            </svg>
        </div>
    </div>

    <!-- Labels -->
    <span
        class="absolute top-4 left-4 px-3 py-1 rounded-full bg-ink-950/70 text-violet-100 text-xs font-semibold border border-white/10 backdrop-blur-sm"
        >Original</span
    >
    <span
        class="absolute top-4 right-4 px-3 py-1 rounded-full bg-violet-600/80 text-white text-xs font-semibold border border-violet-400/50 backdrop-blur-sm"
        >Try-On ✨</span
    >
</div>

<style>
    @keyframes float-up {
        0% {
            transform: translate(-50%, -50%) translateX(var(--offset, 0px))
                translateY(0) scale(0);
            opacity: 0;
        }
        20% {
            opacity: 1;
            transform: translate(-50%, -50%) translateX(var(--offset, 0px))
                translateY(-10px) scale(1);
        }
        100% {
            transform: translate(-50%, -50%) translateX(var(--offset, 0px))
                translateY(-60px) scale(0.5);
            opacity: 0;
        }
    }
</style>
