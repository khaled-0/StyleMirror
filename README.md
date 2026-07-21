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
   git clone https://github.com/khaled-0/StyleMirror.git
   cd StyleMirror
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env to add your DASHSCOPE_API_KEY and an ADMIN_API_KEY of your choice
   ```

3. **Run the stack:**
   ```bash
   docker compose up --build
   ```
   *This will automatically start Postgres, initialize the database schema, start the Go API, and serve the SvelteKit frontend.*

4. **Access the app:**
   Open `http://localhost:5173` in your browser.

### Option B: Local Development

1. **Start Postgres:**
   ```bash
   docker run --name stylemirror-db -e POSTGRES_USER=stylemirror -e POSTGRES_PASSWORD=stylemirror -e POSTGRES_DB=stylemirror -p 5432:5432 -d postgres:16-alpine
   psql -h localhost -U stylemirror -d stylemirror -f db/init.sql
   ```

2. **Start Go API:**
   ```bash
   cd api
   go get github.com/jackc/pgx/v5
   go mod tidy
   export DATABASE_URL="postgres://stylemirror:stylemirror@localhost:5432/stylemirror?sslmode=disable"
   export DASHSCOPE_API_KEY="sk-your-key-here"
   export ADMIN_API_KEY="admin_super_secret_key"
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

## 🔑 Admin & Partner Panels

1. Navigate to `http://localhost:5173/admin`.
2. Enter the `ADMIN_API_KEY` you set in your `.env` file.
3. Create a new Partner (set their name, allowed domain origin, and daily request limit).
4. The Admin panel will output a unique API key (e.g., `sm_live_...`). 
5. As a partner, go to `http://localhost:5173/dashboard`, paste that API key, and you can view your usage limits and the integration snippet.

*(A default demo partner with the key `sm_demo_key_123` is created automatically by `db/init.sql` for testing the landing page).*

---
🧪 Testing the Userscript

Ensure the SvelteKit frontend is running (npm run dev).
Install the Tampermonkey browser extension.
Open the Tampermonkey dashboard and click Create a new script.
Delete the template and paste the StyleMirror Loader script:

```js
// ==UserScript==
// @name         StyleMirror — Loader
// @namespace    https://stylemirror.local
// @version      1.1
// @description  Loads the StyleMirror injector from the dev server.
// @author       khaled-0 — Uttara University
// @match        *://www.aarong.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // 1) Set config BEFORE stylemirror.js runs. The widget reads
  //    window.StyleMirrorConfig once, at load time.
  window.StyleMirrorConfig = {
    apiBase: 'http://localhost:8080',

    // The injector will look for exact matches of this selector.
    // No demo mode, no image size detection — if it matches, the "Try It On" button appears.
    imageSelector: 'img[data-nimg="1"]',

    // Skip thumbnail rails / swatches / recommendation carousels so the
    // "Try It On" button only shows up on the real product shot.
    excludeSelector: '.w-5, img[alt="GooglePlay"], img[alt="AppStore"]'

    apiKey: "<your api key>"
  };

  // 2) Load the widget dynamically from the dev server.
  //    (Alternatively, you can bundle it inline using @require in the header)
  const script = document.createElement('script');
  script.src = 'http://localhost:5173/sdk/stylemirror.js';
  script.onload = () => {
    console.log('[StyleMirror] loaded with config:', window.StyleMirror.getConfig());
  };
  document.documentElement.appendChild(script);

  // 3) You can also reconfigure at any time later — e.g. if the page is a
  //    SPA and the product selector needs to change on client-side navigation:
  //
  //    window.StyleMirror.configure({ imageSelector: '.new-gallery img' });
  //
  // Useful hooks exposed on window.StyleMirror:
  //   .configure(partialConfig)  merge + immediately rescan the page
  //   .getConfig()               read the active config
  //   .rescan()                  force a rescan without changing config
  //   .open(productIndex?)       open the modal programmatically
  //   .close()                   close the modal programmatically
})();
```

Save the script (Ctrl+S).
Visit any e-commerce site (or an Unsplash search page). The floating "Try It On" bar will appear, and overlay buttons will appear on product images.

## 📄 License

This project is an academic thesis submitted to Uttara University. Code is provided for educational and demonstration purposes.
