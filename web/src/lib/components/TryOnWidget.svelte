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
    import Dropzone from "./Dropzone.svelte";
    import WebcamCapture from "./WebcamCapture.svelte";
    import BeforeAfterSlider from "./BeforeAfterSlider.svelte";
    import SkeletonFrame from "./SkeletonFrame.svelte";

    export let garments: { url: string; name: string }[] = [
        {
            url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600",
            name: "White Tee",
        },
        {
            url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600",
            name: "Denim Jacket",
        },
        {
            url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600",
            name: "Summer Dress",
        },
    ];

    let selectedGarment = 0;
    let showWebcam = false;
    let liveRegion = "";
    let pollTimer: ReturnType<typeof setTimeout>;

    const ESTIMATED_SEC = 15;

    async function generate() {
        if (!$bodyImageURL) return;
        resetTryOn();
        tryOnState.set("generating");
        liveRegion =
            "Generating your try-on. This usually takes about 15 seconds.";
        const startTime = Date.now();

        // Progress estimator
        const progInterval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            progress.set(Math.min(90, (elapsed / ESTIMATED_SEC) * 100));
        }, 200);

        try {
            const submit = await submitTryOn(
                garments[selectedGarment].url,
                $bodyImageURL,
            );
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
</script>

<div class="grid md:grid-cols-2 gap-6" aria-live="polite" aria-atomic="true">
    <!-- SR announcer -->
    <div class="sr-only" role="status">{liveRegion}</div>

    <!-- LEFT: Inputs -->
    <div class="space-y-5">
        <div>
            <h3
                class="text-xs font-semibold uppercase tracking-wider text-violet-300/50 mb-3"
            >
                1 · Choose a garment
            </h3>
            <div class="grid grid-cols-3 gap-2">
                {#each garments as g, i}
                    <button
                        class="aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.03]
            {selectedGarment === i
                            ? 'border-violet-400 ring-2 ring-violet-400/30'
                            : 'border-transparent'}"
                        on:click={() => {
                            selectedGarment = i;
                            if ($tryOnState === "done") resetTryOn();
                        }}
                        aria-label="Select {g.name}"
                        aria-pressed={selectedGarment === i}
                    >
                        <img
                            src={g.url}
                            alt={g.name}
                            class="w-full h-full object-cover"
                            loading="lazy"
                        />
                    </button>
                {/each}
            </div>
        </div>

        <div>
            <h3
                class="text-xs font-semibold uppercase tracking-wider text-violet-300/50 mb-3"
            >
                2 · Your photo
            </h3>
            {#if $bodyImageURL}
                <div
                    class="relative w-full aspect-[3/4] max-w-[280px] rounded-xl overflow-hidden"
                >
                    <img
                        src={$bodyImageURL}
                        alt="Your photo"
                        class="w-full h-full object-cover"
                    />
                    <button
                        class="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-black/70 border border-white/15 text-xs text-white"
                        on:click={() => {
                            bodyImageURL.set(null);
                            resetTryOn();
                        }}>Replace</button
                    >
                </div>
                <p class="text-xs text-violet-300/40 mt-2">
                    ✓ Photo saved for this session — try multiple garments
                    without re-uploading.
                </p>
            {:else if showWebcam}
                <div class="mirror p-4">
                    <WebcamCapture
                        on:capture={handleWebcamCapture}
                        on:cancel={() => {
                            showWebcam = false;
                        }}
                    />
                </div>
            {:else}
                <Dropzone
                    on:file={handleFile}
                    on:webcam={() => {
                        showWebcam = true;
                    }}
                    on:error={(e) => {
                        errorMessage.set(e.detail);
                        tryOnState.set("error");
                    }}
                />
            {/if}
        </div>
    </div>

    <!-- RIGHT: Result -->
    <div>
        <h3
            class="text-xs font-semibold uppercase tracking-wider text-violet-300/50 mb-3"
        >
            3 · Result
        </h3>

        {#if $tryOnState === "idle"}
            <div
                class="w-full aspect-[3/4] max-w-[400px] rounded-xl border-2 border-dashed border-white/8 flex items-center justify-center"
            >
                <div class="text-center text-violet-300/40">
                    <div class="text-4xl mb-2">✨</div>
                    <div class="text-sm">
                        Your try-on result will appear here
                    </div>
                </div>
            </div>
        {:else if $tryOnState === "generating"}
            <div class="w-full max-w-[400px] space-y-3">
                <SkeletonFrame />
                <div class="text-center">
                    <div class="text-sm text-violet-300/70">
                        Generating try-on…
                    </div>
                    <div class="text-xs text-violet-300/40 mt-1">
                        Usually takes ~{ESTIMATED_SEC}s
                    </div>
                    <div
                        class="mt-2 w-full h-1 bg-white/5 rounded-full overflow-hidden"
                    >
                        <div
                            class="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-200"
                            style="width: {$progress}%"
                        ></div>
                    </div>
                </div>
            </div>
        {:else if $tryOnState === "done" && $resultURL}
            <div class="w-full max-w-[400px]">
                <BeforeAfterSlider
                    beforeSrc={$bodyImageURL ?? ""}
                    afterSrc={$resultURL}
                    beforeLabel="You"
                    afterLabel="Try-On"
                />
                <button
                    class="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-sm hover:shadow-lg hover:shadow-violet-500/30 transition-all"
                    on:click={generate}>↻ Try Another Garment</button
                >
            </div>
        {:else if $tryOnState === "error"}
            <div
                class="w-full max-w-[400px] p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm"
            >
                <div class="font-semibold mb-1">Generation failed</div>
                <div class="text-xs opacity-80">{$errorMessage}</div>
                <button
                    class="mt-3 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs"
                    on:click={() => {
                        resetTryOn();
                    }}>Try again</button
                >
            </div>
        {/if}

        {#if $tryOnState === "idle" || $tryOnState === "done" || $tryOnState === "error"}
            <button
                class="w-full max-w-[400px] mt-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-violet-500/30 transition-all"
                disabled={!$bodyImageURL}
                on:click={generate}
            >
                {$tryOnState === "done"
                    ? "↻ Try Another Garment"
                    : "Generate Try-On →"}
            </button>
        {/if}
    </div>
</div>
