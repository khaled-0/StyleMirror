<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let raf = 0;
    let scrollProg = 0;
    let mouseX = 0.5,
        mouseY = 0.5;
    let time = 0;
    let resizeObserver: ResizeObserver;

    const posePoints = [
        { x: 0.5, y: 0.12, r: 0.06 },
        { x: 0.5, y: 0.2, r: 0.025 },
        { x: 0.38, y: 0.26 },
        { x: 0.62, y: 0.26 },
        { x: 0.4, y: 0.45 },
        { x: 0.6, y: 0.45 },
        { x: 0.42, y: 0.58 },
        { x: 0.58, y: 0.58 },
        { x: 0.34, y: 0.35 },
        { x: 0.28, y: 0.48 },
        { x: 0.24, y: 0.58 },
        { x: 0.66, y: 0.35 },
        { x: 0.72, y: 0.48 },
        { x: 0.76, y: 0.58 },
        { x: 0.44, y: 0.72 },
        { x: 0.42, y: 0.88 },
        { x: 0.56, y: 0.72 },
        { x: 0.58, y: 0.88 },
    ];

    const skeleton = [
        [0, 1],
        [1, 2],
        [1, 3],
        [2, 4],
        [3, 5],
        [4, 6],
        [5, 7],
        [2, 8],
        [8, 10],
        [8, 12],
        [3, 9],
        [9, 11],
        [9, 13],
        [6, 14],
        [7, 15],
        [4, 5],
    ];

    function resize() {
        if (!ctx || !canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
    }

    function onScroll() {
        if (!canvas) return;
        // Tie progress strictly to viewport scroll.
        // 0 at top of page, 1 after scrolling exactly one screen height.
        const raw = window.scrollY / window.innerHeight;
        scrollProg = Math.max(0, Math.min(1, raw));
    }

    function onMouse(e: MouseEvent) {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / rect.width;
        mouseY = (e.clientY - rect.top) / rect.height;
    }

    function draw() {
        if (!ctx || !canvas) return;
        const w = canvas.clientWidth;
        const hgt = canvas.clientHeight;
        if (w === 0 || hgt === 0) return;

        ctx.clearRect(0, 0, w, hgt);
        time += 0.016;
        const p = scrollProg;

        // 1. Draw a dark overlay that gets darker as you scroll
        // This guarantees the glowing elements pop over the background image
        ctx.fillStyle = `rgba(10, 8, 16, ${0.3 + p * 0.5})`;
        ctx.fillRect(0, 0, w, hgt);

        // 2. Fill silhouette (increases with scroll progress)
        if (p > 0.02) {
            ctx.beginPath();
            ctx.moveTo(w * 0.38, hgt * 0.26);
            ctx.bezierCurveTo(
                w * 0.35,
                hgt * 0.22,
                w * 0.42,
                hgt * 0.12,
                w * 0.5,
                hgt * 0.12,
            );
            ctx.bezierCurveTo(
                w * 0.58,
                hgt * 0.12,
                w * 0.65,
                hgt * 0.22,
                w * 0.62,
                hgt * 0.26,
            );
            ctx.lineTo(w * 0.72, hgt * 0.35);
            ctx.bezierCurveTo(
                w * 0.78,
                hgt * 0.45,
                w * 0.76,
                hgt * 0.55,
                w * 0.7,
                hgt * 0.6,
            );
            ctx.lineTo(w * 0.58, hgt * 0.88);
            ctx.lineTo(w * 0.42, hgt * 0.88);
            ctx.lineTo(w * 0.3, hgt * 0.6);
            ctx.bezierCurveTo(
                w * 0.24,
                hgt * 0.55,
                w * 0.22,
                hgt * 0.45,
                w * 0.28,
                hgt * 0.35,
            );
            ctx.closePath();

            const fill = ctx.createLinearGradient(
                w * 0.3,
                hgt * 0.2,
                w * 0.7,
                hgt * 0.9,
            );
            fill.addColorStop(0, `rgba(167, 139, 250, ${0.4 * p})`);
            fill.addColorStop(0.5, `rgba(99, 102, 241, ${0.5 * p})`);
            fill.addColorStop(1, `rgba(168, 85, 247, ${0.4 * p})`);
            ctx.fillStyle = fill;
            ctx.fill();

            // Heavy glow
            ctx.shadowColor = "rgba(167, 139, 250, 0.8)";
            ctx.shadowBlur = 40 * p;
            ctx.fill();
            ctx.shadowBlur = 0;

            // White edge highlight to make it look like 3D glass
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * p})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // 3. Wireframe skeleton (fades out as we scroll)
        const wireAlpha = 1 - p * 0.95;
        if (wireAlpha > 0.05) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${wireAlpha})`;
            ctx.lineWidth = 2.5; // Thicker line
            ctx.setLineDash([6, 8]);
            ctx.lineDashOffset = -time * 30;

            for (const [a, b] of skeleton) {
                const pa = posePoints[a],
                    pb = posePoints[b];
                ctx.beginPath();
                ctx.moveTo(w * pa.x, hgt * pa.y);
                ctx.lineTo(w * pb.x, hgt * pb.y);
                ctx.stroke();
            }

            ctx.setLineDash([]);
            for (const pt of posePoints) {
                const pulse = 1 + Math.sin(time * 3 + pt.x * 10) * 0.3;
                ctx.beginPath();
                ctx.arc(w * pt.x, hgt * pt.y, 4 * pulse, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(167, 139, 250, ${wireAlpha})`;
                ctx.fill();

                // Glowing joints
                ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // 4. Floating particles
        for (let i = 0; i < 40; i++) {
            const seed = i * 0.137;
            const px = w * (0.5 + Math.sin(time * 0.3 + seed * 10) * 0.35);
            const py =
                hgt * (0.1 + ((seed + time * 0.05 * (1 + p)) % 1) * 0.85);
            const size = 1.5 + Math.sin(time * 2 + seed * 5) * 0.8;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 180, 255, ${0.4 + p * 0.4})`;
            ctx.fill();
        }

        raf = requestAnimationFrame(draw);
    }

    onMount(() => {
        ctx = canvas.getContext("2d")!;

        resizeObserver = new ResizeObserver(() => {
            resize();
        });
        resizeObserver.observe(canvas);

        window.addEventListener("resize", resize);
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("mousemove", onMouse);
        onScroll(); // Trigger initial state
        raf = requestAnimationFrame(draw);
    });

    onDestroy(() => {
        if (!browser) return;
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("mousemove", onMouse);
        if (resizeObserver) resizeObserver.disconnect();
    });
</script>

<canvas
    bind:this={canvas}
    class="w-full h-full block"
    aria-label="Animated silhouette morphing from wireframe to rendered garment as you scroll"
/>
