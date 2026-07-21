<script lang="ts">
  import { onMount } from 'svelte';
  import { getUsage, logout } from '$lib/api';

  let isAuthed = false;
  let loading = true;
  let usage = { used_today: 0, limit: 0 };

  let inputKey = '';
  let activeKey = '';
  let snippetCopied = false;
  let htmlCopied = false;
  let errorMessage = '';

  // Generate the snippet string reactively
  // Generate the snippet string reactively
  $: sdkSnippet = `<script>
  window.StyleMirrorConfig = {
    apiKey: "${activeKey}",               // Required: Your Partner API Key
    apiBase: "http://localhost:8080",     // Optional: API endpoint (change for production)
    imageSelector: "img.product-image",  // Required: CSS selector for your main product images
    excludeSelector: ".thumbnail img"    // Optional: CSS selector to exclude (e.g. thumbnails)
  };
</` + `script>
<script src="https://your-domain.com/stylemirror.user.js" defer></` + `script>`;

  $: htmlSnippet = `<img src="/products/tee.jpg" data-stylemirror="true" alt="Cotton Tee" />`;

  onMount(async () => {
    const savedKey = localStorage.getItem('sm_partner_key');
    if (savedKey) {
      activeKey = savedKey;
      isAuthed = true;
      await loadUsage();
    } else {
      loading = false;
    }
  });

  async function loadUsage() {
    loading = true;
    errorMessage = '';
    try {
      usage = await getUsage();
    } catch (e: any) {
      const msg = e.message || 'Failed to fetch usage.';
      if (msg.includes('401') || msg.includes('403') || msg.includes('invalid api key') || msg.includes('origin not allowed')) {
        localStorage.removeItem('sm_partner_key');
        isAuthed = false;
        activeKey = '';
        errorMessage = msg.includes('origin') ? 'This domain is not authorized.' : 'Your API key is invalid or revoked. Please log in again.';
      } else {
        errorMessage = msg;
      }
    } finally {
      loading = false;
    }
  }

  function handleLogin() {
    if (!inputKey.trim()) return;
    localStorage.setItem('sm_partner_key', inputKey.trim());
    activeKey = inputKey.trim();
    isAuthed = true;
    inputKey = '';
    errorMessage = '';
    loadUsage();
  }

  function handleLogout() {
    logout(false);
  }

  function copyText(text: string, type: 'sdk' | 'html') {
    navigator.clipboard.writeText(text);
    if (type === 'sdk') {
      snippetCopied = true;
      setTimeout(() => snippetCopied = false, 2000);
    } else {
      htmlCopied = true;
      setTimeout(() => htmlCopied = false, 2000);
    }
  }
</script>

<svelte:head><title>Partner Dashboard — StyleMirror</title></svelte:head>

<section class="py-16 px-6 min-h-[80vh]">
  <div class="max-w-5xl mx-auto">

    <!-- UNAUTHED VIEW: Login Form -->
    {#if !isAuthed}
      <div class="max-w-md mx-auto mt-20">
        <h1 class="font-display text-4xl font-700 mb-2 text-center">Partner Login</h1>
        <p class="text-violet-300/50 mb-8 text-center">Enter your API key to access your dashboard.</p>
        <div class="p-6 mirror-surface">
          <label class="text-xs uppercase tracking-wider text-violet-300/40 mb-2 block">Your API Key</label>
          <input
            type="password"
            bind:value={inputKey}
            placeholder="sm_live_..."
            class="w-full bg-ink-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-violet-200 font-mono focus:border-violet-400 outline-none mb-4"
            on:keydown={(e) => { if (e.key === 'Enter') handleLogin(); }}
          />
          {#if errorMessage}
            <div class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
              {errorMessage}
            </div>
          {/if}
          <button
            class="w-full py-2.5 rounded-lg bg-violet-600 text-white font-medium text-sm hover:bg-violet-500 transition-colors"
            on:click={handleLogin}
          >Login to Dashboard</button>
        </div>
      </div>

    <!-- AUTHED VIEW: Dashboard -->
    {:else}
      <div class="flex justify-between items-center mb-10">
        <div>
          <h1 class="font-display text-4xl font-700 mb-2">Partner Dashboard</h1>
          <p class="text-violet-300/50">Monitor usage and integrate the SDK.</p>
        </div>
        <button on:click={handleLogout} class="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition-colors">Logout</button>
      </div>

      <!-- Usage Stats -->
      <div class="grid md:grid-cols-3 gap-4 mb-8">
        <div class="p-6 mirror-surface">
          <div class="text-xs uppercase tracking-wider text-violet-300/40 mb-2">Requests Used Today</div>
          {#if loading}<div class="h-8 w-16 skeleton rounded"></div>{:else}
          <div class="font-display text-3xl font-700">{usage.used_today} <span class="text-violet-300/30 text-lg">/ {usage.limit}</span></div>
          {/if}
        </div>

        <!-- Snippet 1: SDK Script -->
        <div class="p-6 mirror-surface md:col-span-2">
          <div class="flex justify-between items-center mb-2">
            <div class="text-xs uppercase tracking-wider text-violet-300/40">1. Install SDK</div>
            <button on:click={() => copyText(sdkSnippet, 'sdk')} class="text-xs text-violet-400 hover:text-violet-300">
              {snippetCopied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <pre class="bg-ink-950/80 rounded-xl p-4 text-xs text-violet-200 overflow-x-auto border border-white/5 mt-2"><code>{sdkSnippet}</code></pre>
          <p class="text-xs text-violet-300/40 mt-3">Paste this into your website's <code>&lt;head&gt;</code> tag.</p>
        </div>
      </div>

      <!-- Snippet 2: HTML Attribute -->
      <div class="p-6 mirror-surface">
        <div class="flex justify-between items-center mb-2">
          <div class="text-xs uppercase tracking-wider text-violet-300/40">2. Enable Product Images</div>
          <button on:click={() => copyText(htmlSnippet, 'html')} class="text-xs text-violet-400 hover:text-violet-300">
            {htmlCopied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <pre class="bg-ink-950/80 rounded-xl p-4 text-xs text-violet-200 overflow-x-auto border border-white/5 mt-2"><code>{htmlSnippet}</code></pre>
        <p class="text-xs text-violet-300/40 mt-3">Add the <code>data-stylemirror="true"</code> attribute to any product image tag on your site. The overlay button will appear automatically.</p>
      </div>
    {/if}
  </div>
</section>
