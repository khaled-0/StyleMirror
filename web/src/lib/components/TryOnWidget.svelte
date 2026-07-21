<script lang="ts">
    import { submitTryOn, pollStatus } from "$lib/api";
    import {
        bodyImageURL,
        tryOnState,
        resultURL,
        errorMessage,
        progress,
        resetTryOn,
    } from "$lib/stores/tryon";

    // Svelte Transitions & Animations
    import { fade, scale, fly } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import { flip } from 'svelte/animate';

    // Components
    import Dropzone from "./Dropzone.svelte";
    import WebcamCapture from "./WebcamCapture.svelte";
    import MagicSlider from "./MagicSlider.svelte";
    import SkeletonFrame from "./SkeletonFrame.svelte";

    // Trending Garments - modern fashion catalog
    export let garments = [
      {
        url: "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=600",
        name: "Oversized Luxury Blazer"
      },
      {
        url: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600",
        name: "Elegant Satin Slip Dress"
      },
      {
        url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600",
        name: "Minimal Tailored Shirt"
      }
    ];


    // Trending AI Try-On Collection
    const suggestedGarments = [
      {
        url: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400",
        name: "Soft Luxury Knit Sweater"
      },
      {
        url: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400",
        name: "Contemporary Casual Look"
      },
      {
        url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400",
        name: "Classic Camel Coat"
      },
      {
        url: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=400",
        name: "Minimal Trench Coat"
      },
      {
        url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400",
        name: "Luxury Black Evening Dress"
      },
      {
        url: "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400",
        name: "Utility Overshirt Jacket"
      },
      {
        url: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400",
        name: "Cream Cable Knit Sweater"
      }
    ];


    let selectedGarment = 0;
    let showWebcam = false;
    let liveRegion = "";
    let pollTimer: ReturnType<typeof setTimeout>;
    let fileInput: HTMLInputElement;

    const ESTIMATED_SEC = 15;

    async function generate() {
        if (!$bodyImageURL) return;
        resetTryOn();
        tryOnState.set("generating");
        liveRegion = "Generating your try-on. This usually takes about 15 seconds.";

        const startTime = Date.now();
        const progInterval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            progress.set(Math.min(90, (elapsed / ESTIMATED_SEC) * 100));
        }, 200);

        try {
            const submit = await submitTryOn(garments[selectedGarment].url, $bodyImageURL);
            const poll = async () => {
                const status = await pollStatus(submit.task_id);
                if (status.status === "succeeded") {
                    clearInterval(progInterval);
                    progress.set(100);
                    resultURL.set(status.result_url || null);
                    tryOnState.set("done");
                    liveRegion = "Your try-on is ready.";
                } else if (status.status === "failed") {
                    clearInterval(progInterval);
                    errorMessage.set(status.error || "Generation failed.");
                    tryOnState.set("error");
                    liveRegion = "Try-on failed.";
                } else {
                    pollTimer = setTimeout(poll, status.poll_after_ms || 1500);
                }
            };
            await poll();
        } catch (e: any) {
            clearInterval(progInterval);
            errorMessage.set(e.message);
            tryOnState.set("error");
            liveRegion = "Try-on failed: " + e.message;
        }
    }

    function handleFile(e: CustomEvent) {
        bodyImageURL.set(e.detail.dataURL);
    }

    function handleWebcamCapture(e: CustomEvent) {
        bodyImageURL.set(e.detail);
        showWebcam = false;
    }

    function handleGarmentUpload(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
            const file = target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const newGarment = {
                    url: event.target?.result as string,
                    name: "Custom Garment"
                };
                garments = [...garments, newGarment];
                selectedGarment = garments.length - 1;
                if ($tryOnState === "done") resetTryOn();
            };
            reader.readAsDataURL(file);
        }
    }

    function selectSuggested(g: { url: string; name: string }) {
        garments = [...garments, g];
        selectedGarment = garments.length - 1;
        if ($tryOnState === "done") resetTryOn();

        // Smooth scroll back to top of section
        document.getElementById('try-on-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
</script>

<div id="try-on-top" class="relative max-w-6xl mx-auto px-4 py-12 md:py-20">
    <!-- Background Ambient Glows -->
    <div class="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>

    <div class="relative z-10">
        <!-- Header -->
        <div class="text-center mb-12" in:fade={{ duration: 400 }}>
            <div class="inline-block mb-4 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium tracking-wide">
                AI POWERED VIRTUAL FITTING
            </div>
            <h1 class="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
                See It On <span class="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Yourself</span>
            </h1>
            <p class="text-violet-200/60 max-w-xl mx-auto">
                Upload your photo, pick a garment, and let our AI generate a photorealistic preview in seconds.
            </p>
        </div>

        <!-- Main Layout -->
        <div class="grid lg:grid-cols-2 gap-8" aria-live="polite" aria-atomic="true">
            <div class="sr-only" role="status">{liveRegion}</div>

            <!-- LEFT: Inputs -->
            <div class="space-y-8 p-6 md:p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/20" in:fade={{ duration: 500, delay: 100 }}>

                <!-- Garment Selection -->
                <div>
                    <h3 class="text-sm font-semibold uppercase tracking-wider text-violet-300/70 mb-4 flex items-center gap-2">
                        <span class="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs">1</span>
                        Select a Garment
                    </h3>
                    <div class="grid grid-cols-4 gap-3">
                        {#each garments as g, i (g.url)}
                            <button
                                class="group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300
                                {selectedGarment === i
                                    ? 'border-violet-400 ring-4 ring-violet-400/20 scale-95'
                                    : 'border-transparent hover:border-white/20 hover:scale-[1.03]'}"
                                on:click={() => {
                                    selectedGarment = i;
                                    if ($tryOnState === "done") resetTryOn();
                                }}
                                aria-label="Select {g.name}"
                                aria-pressed={selectedGarment === i}
                                animate:flip={{ duration: 300 }}
                            >
                                <img src={g.url} alt={g.name} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                                <div class="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                                    <span class="text-[10px] font-medium text-white block truncate">{g.name}</span>
                                </div>
                                {#if selectedGarment === i}
                                    <div class="absolute top-1.5 right-1.5 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center text-white text-[10px]">
                                        ✓
                                    </div>
                                {/if}
                            </button>
                        {/each}

                        <!-- Upload Custom Garment Tile -->
                        <button
                            class="group aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-violet-400/50 hover:bg-violet-500/5 flex flex-col items-center justify-center gap-1 transition-all duration-300 hover:scale-[1.03]"
                            on:click={() => fileInput.click()}
                            aria-label="Upload your own garment"
                        >
                            <svg class="w-6 h-6 text-violet-300/50 group-hover:text-violet-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            <span class="text-[10px] text-violet-300/50 group-hover:text-violet-300 font-medium">Upload</span>
                        </button>
                        <input type="file" accept="image/*" class="hidden" bind:this={fileInput} on:change={handleGarmentUpload} />
                    </div>
                </div>

                <!-- Photo Capture -->
                <div>
                    <h3 class="text-sm font-semibold uppercase tracking-wider text-violet-300/70 mb-4 flex items-center gap-2">
                        <span class="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs">2</span>
                        Your Photo
                    </h3>

                    {#if $bodyImageURL}
                        <div class="relative w-full aspect-[3/4] max-w-[280px] mx-auto rounded-2xl overflow-hidden group" in:scale={{ duration: 300, start: 0.9 }}>
                            <img src={$bodyImageURL} alt="Your photo" class="w-full h-full object-cover" />
                            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-4">
                                <button
                                    class="px-4 py-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-xs text-white font-medium hover:bg-white/20 transition-all"
                                    on:click={() => {
                                        bodyImageURL.set(null);
                                        resetTryOn();
                                    }}
                                >
                                    Replace Photo
                                </button>
                            </div>
                        </div>
                        <p class="text-xs text-violet-300/40 mt-3 text-center flex items-center justify-center gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                            Photo ready. Try multiple garments below!
                        </p>
                    {:else if showWebcam}
                        <div class="p-4 rounded-2xl bg-black/20 border border-white/10" in:fade={{ duration: 200 }}>
                            <WebcamCapture
                                on:capture={handleWebcamCapture}
                                on:cancel={() => { showWebcam = false; }}
                            />
                        </div>
                    {:else}
                        <div in:fade={{ duration: 200 }}>
                            <Dropzone
                                on:file={handleFile}
                                on:webcam={() => { showWebcam = true; }}
                                on:error={(e) => { errorMessage.set(e.detail); tryOnState.set("error"); }}
                            />
                        </div>
                    {/if}
                </div>
            </div>

            <!-- RIGHT: Result -->
            <div class="relative p-6 md:p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/20 flex flex-col" in:fade={{ duration: 500, delay: 200 }}>
                <h3 class="text-sm font-semibold uppercase tracking-wider text-violet-300/70 mb-4 flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs">3</span>
                    Result
                </h3>

                <div class="flex-1 flex items-center justify-center min-h-[400px]">
                    {#if $tryOnState === "idle"}
                        <div class="text-center text-violet-300/30" in:fade={{ duration: 300 }}>
                            <div class="relative w-24 h-24 mx-auto mb-6">
                                <div class="absolute inset-0 rounded-full bg-violet-500/10 animate-ping"></div>
                                <div class="relative w-24 h-24 rounded-full bg-violet-500/10 flex items-center justify-center text-4xl">✨</div>
                            </div>
                            <div class="text-base font-medium text-violet-200/70">Your try-on result will appear here</div>
                            <div class="text-xs text-violet-300/40 mt-2 max-w-[220px] mx-auto">Select a garment and upload your photo to get started.</div>
                        </div>
                    {:else if $tryOnState === "generating"}
                        <div class="w-full max-w-[400px] space-y-4" in:fade={{ duration: 300 }}>
                            <SkeletonFrame />
                            <div class="text-center">
                                <div class="text-sm font-medium text-violet-200 flex items-center justify-center gap-2">
                                    <svg class="animate-spin h-4 w-4 text-violet-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Generating try-on…
                                </div>
                                <div class="text-xs text-violet-300/40 mt-1">Usually takes ~{ESTIMATED_SEC}s</div>
                                <div class="mt-4 w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        class="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-200 ease-out rounded-full"
                                        style="width: {$progress}%"
                                    ></div>
                                </div>
                            </div>
                        </div>
                    {:else if $tryOnState === "done" && $resultURL}
                        <div class="w-full max-w-[400px]" in:scale={{ duration: 400, start: 0.8, easing: quintOut }}>
                            <MagicSlider
                                beforeSrc={$bodyImageURL ?? ""}
                                afterSrc={$resultURL}
                            />
                        </div>
                    {:else if $tryOnState === "error"}
                        <div class="w-full max-w-[400px] p-6 rounded-2xl bg-red-500/5 border border-red-500/20 text-center" in:scale={{ duration: 300 }}>
                            <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center text-2xl">⚠️</div>
                            <div class="font-semibold text-red-200 mb-1">Generation Failed</div>
                            <div class="text-xs text-red-200/60 mb-4">{$errorMessage}</div>
                            <button
                                class="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition-colors"
                                on:click={() => { resetTryOn(); }}
                            >
                                Try Again
                            </button>
                        </div>
                    {/if}
                </div>

                <!-- Generate Button -->
                {#if $tryOnState === "idle" || $tryOnState === "done"}
                    <button
                        class="w-full max-w-[400px] mx-auto mt-6 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_8px_30px_rgb(139,92,246,0.4)] transition-all duration-300 flex items-center justify-center gap-2 group"
                        disabled={!$bodyImageURL}
                        on:click={$tryOnState === "done" ? resetTryOn : generate}
                        in:fly={{ y: 20, duration: 400, delay: 200 }}
                    >
                        {$tryOnState === "done" ? "↻ Try Another Garment" : "Generate Try-On"}
                        {#if $tryOnState !== "done"}
                            <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        {/if}
                    </button>
                {/if}
            </div>
        </div>

        <!-- Suggested Garments -->
        <div class="mt-16" in:fade={{ duration: 500, delay: 400 }}>
            <div class="flex items-end justify-between mb-6 border-b border-white/5 pb-3">
                <div>
                    <h3 class="text-xl font-semibold text-white">Trending Styles</h3>
                    <p class="text-xs text-violet-300/40 mt-1">Click an item to instantly try it on</p>
                </div>
            </div>

            <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                {#each suggestedGarments as g, i (g.url)}
                    <button
                        class="group flex-shrink-0 w-40 md:w-48 relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-violet-900/30"
                        on:click={() => selectSuggested(g)}
                        in:fly={{ x: 20, duration: 400, delay: 400 + i * 50 }}
                    >
                        <div class="aspect-[3/4] w-full">
                            <img src={g.url} alt={g.name} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                        </div>
                        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>
                        <div class="absolute bottom-0 left-0 right-0 p-4">
                            <div class="text-sm font-semibold text-white">{g.name}</div>
                            <div class="mt-2 flex items-center gap-1 text-xs text-violet-300 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:-translate-x-1">
                                Try it on <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            </div>
                        </div>
                    </button>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    /* Hide scrollbar for Chrome, Safari and Opera */
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }

    /* Hide scrollbar for IE, Edge and Firefox */
    .scrollbar-hide {
        -ms-overflow-style: none;  /* IE and Edge */
        scrollbar-width: none;  /* Firefox */
    }
</style>
