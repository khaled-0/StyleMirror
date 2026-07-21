<script lang="ts">
  import { onMount } from 'svelte';
  import { getAdminPartners, createPartner, deletePartner, logout, type PartnerUsage } from '$lib/api';

  let isAuthed = false;
  let loading = true;
  let partners: PartnerUsage[] = [];
  let error = '';

  let inputAdminKey = '';

  let newName = '';
  let newOrigin = '*';
  let newLimit = 20;
  let createdPartner = '';

  onMount(async () => {
    const savedKey = localStorage.getItem('sm_admin_key');
    if (savedKey) {
      isAuthed = true;
      await loadPartners();
    } else {
      loading = false;
    }
  });

  async function loadPartners() {
    loading = true; error = '';
    try {
      partners = await getAdminPartners();
    } catch (e: any) {
      error = 'Failed to fetch. Session might be expired.';
      handleLogout();
    } finally {
      loading = false;
    }
  }

  function handleLogin() {
    if (!inputAdminKey.trim()) return;
    localStorage.setItem('sm_admin_key', inputAdminKey.trim());
    isAuthed = true;
    inputAdminKey = '';
    loadPartners();
  }

  function handleLogout() {
    logout(true);
  }

  async function handleCreate() {
    try {
      const p = await createPartner(newName, newOrigin, newLimit);
      createdPartner = p.api_key || '';
      newName = ''; newOrigin = '*'; newLimit = 20;
      await loadPartners();
    } catch (e) {
      error = 'Failed to create partner';
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete partner "${name}"?`)) return;
    try {
      await deletePartner(id);
      await loadPartners();
    } catch (e) {
      error = 'Failed to delete partner';
    }
  }
</script>

<svelte:head><title>Admin Panel — StyleMirror</title></svelte:head>

<section class="py-16 px-6 min-h-[80vh]">
  <div class="max-w-6xl mx-auto">

    <!-- UNAUTHED VIEW: Admin Login -->
    {#if !isAuthed}
      <div class="max-w-md mx-auto mt-20">
        <h1 class="font-display text-4xl font-700 mb-2 text-center">Admin Access</h1>
        <p class="text-violet-300/50 mb-8 text-center">Enter the master admin secret key.</p>
        <div class="p-6 mirror-surface">
          <label class="text-xs uppercase tracking-wider text-violet-300/40 mb-2 block">Admin Secret Key</label>
          <input
            type="password"
            bind:value={inputAdminKey}
            class="w-full bg-ink-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-violet-200 font-mono focus:border-violet-400 outline-none mb-4"
            on:keydown={(e) => { if (e.key === 'Enter') handleLogin(); }}
          />
          <button
            class="w-full py-2.5 rounded-lg bg-ink-700 border border-white/10 text-white font-medium text-sm hover:bg-ink-800 transition-colors"
            on:click={handleLogin}
          >Unlock Admin Panel</button>
          {#if error}<p class="text-red-400 text-sm mt-4 text-center">{error}</p>{/if}
        </div>
      </div>

    <!-- AUTHED VIEW: Admin Dashboard -->
    {:else}
      <div class="flex justify-between items-center mb-10">
        <div>
          <h1 class="font-display text-4xl font-700 mb-2">Admin Control Panel</h1>
          <p class="text-violet-300/50">Manage partners and system usage.</p>
        </div>
        <button on:click={handleLogout} class="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition-colors">Logout</button>
      </div>

      <div class="grid md:grid-cols-3 gap-6">
        <!-- Create Partner -->
        <!-- Create Partner -->
        <div class="md:col-span-1">
          <div class="p-6 mirror-surface">
            <h2 class="font-display text-xl font-700 mb-4">Create Partner</h2>
            {#if createdPartner}
              <div class="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p class="text-xs text-green-300 mb-1">Partner Created! API Key:</p>
                <p class="font-mono text-xs text-green-200 break-all">{createdPartner}</p>
              </div>
            {/if}
            <div class="space-y-4">
              <div>
                <label class="text-xs uppercase tracking-wider text-violet-300/40 mb-2 block">Partner Name</label>
                <input bind:value={newName} placeholder="e.g. Acme Fashion" class="w-full bg-ink-950 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-violet-400 outline-none"/>
              </div>
              <div>
                <label class="text-xs uppercase tracking-wider text-violet-300/40 mb-2 block">Allowed Origin</label>
                <input bind:value={newOrigin} placeholder="e.g. https://shop.com" class="w-full bg-ink-950 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-violet-400 outline-none"/>
                <p class="text-xs text-violet-300/30 mt-1">Use * to allow any domain</p>
              </div>
              <div>
                <label class="text-xs uppercase tracking-wider text-violet-300/40 mb-2 block">Daily Limit</label>
                <input type="number" bind:value={newLimit} placeholder="e.g. 50" class="w-full bg-ink-950 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-violet-400 outline-none"/>
              </div>
              <button on:click={handleCreate} class="w-full py-2.5 rounded-lg bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-colors">Generate API Key</button>
            </div>
          </div>
        </div>

        <!-- Partners Table -->
        <div class="md:col-span-2">
          <div class="p-6 mirror-surface">
            <h2 class="font-display text-xl font-700 mb-4">Active Partners</h2>
            {#if loading}
              <div class="space-y-2">
                <div class="h-12 skeleton rounded-lg"></div>
                <div class="h-12 skeleton rounded-lg"></div>
                <div class="h-12 skeleton rounded-lg"></div>
              </div>
            {:else}
              <div class="space-y-3">
                {#each partners || [] as p}
                  <div class="flex items-center justify-between p-3 bg-ink-950/50 rounded-lg border border-white/5">
                    <div>
                      <div class="font-semibold text-sm">{p.partner.name}</div>
                      <div class="text-xs text-violet-300/40 font-mono">{p.partner.allowed_origin}</div>
                    </div>
                    <div class="flex items-center gap-4">
                      <div class="text-right">
                        <div class="font-mono text-xs text-violet-300/60">{p.used_today} / {p.partner.daily_limit}</div>
                        <div class="text-xs text-violet-300/30">requests today</div>
                      </div>
                      <button
                        on:click={() => handleDelete(p.partner.id, p.partner.name)}
                        class="text-red-400/50 hover:text-red-400 transition-colors p-2"
                        aria-label="Delete partner"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</section>
