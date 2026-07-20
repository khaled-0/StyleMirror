<script lang="ts">
    import '../app.css';
    import { page } from '$app/stores';
</script>

<nav class="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-ink-950/60 border-b border-white/5">
  <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2 font-display text-xl font-700">
      <img src="/favicon.svg" class="inline-block w-8 h-8 rounded-md bg-gradient-to-br from-violet-400 to-indigo-600"/>
      StyleMirror
    </a>
    <div class="flex items-center gap-6 text-sm">
      <a href="/demo" class="hover:text-violet-300 transition-colors {$page.url.pathname === '/demo' ? 'text-violet-300' : ''}">Demo</a>
      <a href="/dashboard" class="hover:text-violet-300 transition-colors {$page.url.pathname === '/dashboard' ? 'text-violet-300' : ''}">Dashboard</a>
      <a href="https://github.com" class="px-4 py-1.5 rounded-lg border border-white/10 hover:border-violet-400/50 transition-colors">GitHub</a>
    </div>
  </div>
</nav>

<main class="pt-16">
  <slot />
</main>
