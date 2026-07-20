<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte";

    const dispatch = createEventDispatcher();

    let video: HTMLVideoElement;
    let stream: MediaStream | null = null;
    let error = "";
    let showConsent = true;

    async function start() {
        showConsent = false;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 720 },
                    height: { ideal: 960 },
                },
            });
            video.srcObject = stream;
        } catch (e: any) {
            error =
                e.message ||
                "Camera access denied. Please ensure no other app is using it and you have granted permissions.";
        }
    }

    function capture() {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");

        if (ctx) {
            // Flip horizontally for mirror effect
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        const dataURL = canvas.toDataURL("image/jpeg", 0.9);
        dispatch("capture", dataURL);
        stop();
    }

    function stop() {
        stream?.getTracks().forEach((t) => t.stop());
        stream = null;
        dispatch("cancel");
    }

    onDestroy(() => {
        stream?.getTracks().forEach((t) => t.stop());
    });
</script>

{#if showConsent}
    <div class="text-center p-6">
        <div class="text-3xl mb-3">📷</div>
        <h4 class="font-display text-lg font-semibold mb-2">Camera Access</h4>
        <p class="text-sm text-violet-300/60 mb-4 leading-relaxed">
            Your live video stream stays in your browser. When you capture a
            photo, it's sent to our servers for try-on generation and deleted
            shortly after.
        </p>
        <div class="flex gap-2 justify-center">
            <button
                class="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium text-sm"
                on:click={start}>Allow Camera</button
            >
            <button
                class="px-4 py-2 rounded-lg border border-white/10 text-sm"
                on:click={() => dispatch("cancel")}>Cancel</button
            >
        </div>
    </div>
{:else if error}
    <div class="p-4 text-center text-red-300 text-sm">{error}</div>
    <button
        class="block mx-auto mt-2 text-sm text-violet-400 underline"
        on:click={() => dispatch("cancel")}>Back to upload</button
    >
{:else}
    <!-- Mirror the live video feed -->
    <video
        bind:this={video}
        autoplay
        playsinline
        class="w-full rounded-xl"
        style="transform: scaleX(-1);"
    ></video>
    <div class="flex gap-2 mt-3">
        <button
            class="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold text-sm"
            on:click={capture}
        >
            📸 Capture
        </button>
        <button
            class="flex-1 py-2.5 rounded-lg border border-white/10 text-sm"
            on:click={stop}
        >
            Cancel
        </button>
    </div>
{/if}
