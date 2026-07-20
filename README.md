# 🪞 StyleMirror — Virtual Try-On System

**BSc Computer Science Thesis Project · Uttara University**

StyleMirror is a Virtual Try-On (VTON) system focused on deployment feasibility and clean architecture. It allows users to visualize garments on themselves directly within e-commerce interfaces, without the overhead of training custom PyTorch models or maintaining complex microservices.

By leveraging Qwen Team's `qwen-image-edit` model via a single synchronous HTTPS call, this project collapses the traditional 4-tier ML pipeline (Client → API → Queue → Worker) into a robust, defensible 3-tier system.

---

## ✨ Key Features

- **Simplified 3-Tier Architecture:** Go API, Redis state store, SvelteKit frontend.
- **Dual Interface:** Works as an embedded SvelteKit demo widget on the landing page, and as a Tampermonkey userscript injecting try-on UI into partner sites via Shadow DOM.
- **Magic Slider Reveal:** A custom canvas/SVG-based before/after slider with a blurry, magical particle effect that reveals the try-on result.
- **Real UX States:** Skeleton loaders shaped like the result frame, progress estimations ("usually takes ~15s"), and persistent body photos across multiple garment try-ons.
- **Webcam Capture:** `getUserMedia` integration with explicit consent screens and mirrored preview.
- **Accessibility:** Keyboard-navigable modals, focus traps, and `aria-live` regions for screen readers.
---

## 🏗️ Architecture

1. **Client/Injector (Tampermonkey):** Vanilla JS, Shadow DOM. Reads `data-stylemirror="true"` tags in production.
2. **API + Inference Service (Go):** `chi` router. Validates inputs, calls DashScope directly over HTTPS, returns results. Redis is used _only_ as a lightweight status store for async polling.
3. **Frontend (SvelteKit + TS + Tailwind):** Landing page with an interactive magic slider, embedded live demo, and a partner dashboard.

---

## 🚀 Quick Start

### Prerequisites

- [Go 1.22+](https://go.dev/dl/)
- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (if running via containers)
- A **DashScope API Key** from Aliyun Model Studio.

### Option A: Full Docker (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/stylemirror.git
   cd stylemirror
   ```


2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env and add your DASHSCOPE_API_KEY
   ```

3. **Run the stack:**

   ```bash
   docker compose up --build
   ```

4. **Access the app:**
   Open `http://localhost:5173` in your browser.

### Option B: Local Development

1. **Start Redis:**

   ```bash
   docker run -p 6379:6379 redis:7-alpine
   ```

2. **Start Go API:**

   ```bash
   cd api
   export DASHSCOPE_API_KEY=sk-your-key-here
   export REDIS_ADDR=localhost:6379
   go run . -config config.yaml
   ```

3. **Start SvelteKit Frontend:**
   ```bash
   cd web
   npm install
   echo "VITE_API_BASE=http://localhost:8080" > .env
   npm run dev
   ```

---

🧪 Testing the Userscript

Ensure the SvelteKit frontend is running (npm run dev).
Install the Tampermonkey browser extension.
Open the Tampermonkey dashboard and click Create a new script.
Delete the template and paste the StyleMirror Loader script:

```
// ==UserScript==
// @name         StyleMirror — Loader
// @namespace    https://stylemirror.local
// @version      1.0
// @description  Loads the StyleMirror injector from the dev server.
// @author       BSc Thesis — Uttara University
// @match        *://www.aarong.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==
(function() {
    'use strict';

    // Change this if your SvelteKit server is on a different port
    const scriptUrl = 'http://localhost:5173/sdk/stylemirror.js';

    GM_xmlhttpRequest({
        method: "GET",
        url: scriptUrl,
        onload: function(response) {
            if (response.status === 200) {
                // Inject the fetched code directly into the page context
                const script = document.createElement('script');
                script.textContent = response.responseText;
                (document.head || document.documentElement).appendChild(script);
                // Remove it immediately so it doesn't clutter the DOM
                script.remove();
            } else {
                console.warn(`[StyleMirror Loader] Failed to load script (Status: ${response.status}). Is SvelteKit running?`);
            }
        },
        onerror: function() {
            console.warn('[StyleMirror Loader] Network error. Is SvelteKit running on http://localhost:5173?');
        }
    });
})();
```

Save the script (Ctrl+S).
Visit any e-commerce site (or an Unsplash search page). The floating "Try It On" bar will appear, and overlay buttons will appear on product images.

## 📄 License

This project is an academic thesis submitted to Uttara University. Code is provided for educational and demonstration purposes.
