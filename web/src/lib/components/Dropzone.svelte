<script lang="ts">
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    let dragOver = false;
    let input: HTMLInputElement;

    function handleFile(file: File) {
        if (!file.type.startsWith("image/")) {
            dispatch("error", "Please select an image file.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            dispatch("error", "Image must be under 5 MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                if (img.width < 200 || img.height < 200) {
                    dispatch(
                        "error",
                        "Image too small. Use at least 200×200 px.",
                    );
                    return;
                }
                const ar = img.width / img.height;
                if (ar > 2.5 || ar < 0.4) {
                    dispatch(
                        "error",
                        "Aspect ratio looks off. Use a portrait or square photo.",
                    );
                    return;
                }
                dispatch("file", { dataURL: reader.result, file });
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    }
    function handleInputChange(e: Event) {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];

        if (file) {
            handleFile(file);
        }
    }
    function openWebcam() {
        dispatch("webcam");
    }
</script>

<div
    class="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all min-h-[180px] flex flex-col items-center justify-center gap-2
  {dragOver
        ? 'border-violet-400 bg-violet-500/5'
        : 'border-white/12 hover:border-white/20'}"
    role="button"
    tabindex="0"
    aria-label="Upload photo"
    on:click={() => input.click()}
    on:keydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.click();
        }
    }}
    on:dragover={(e) => {
        e.preventDefault();
        dragOver = true;
    }}
    on:dragleave={() => {
        dragOver = false;
    }}
    on:drop={(e) => {
        e.preventDefault();
        dragOver = false;
        const f = e.dataTransfer?.files[0];
        if (f) handleFile(f);
    }}
>
    <div class="text-2xl opacity-60">📸</div>
    <div class="text-sm text-violet-300/70">
        Drag a photo here or click to browse
    </div>
    <div
        class="text-xs text-violet-400 underline cursor-pointer"
        on:click|stopPropagation={openWebcam}
    >
        or use webcam
    </div>
    <input
        bind:this={input}
        type="file"
        accept="image/*"
        class="hidden"
        on:change={handleInputChange}
    />
</div>
