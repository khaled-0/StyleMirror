import { writable } from 'svelte/store';

export type TryOnState = 'idle' | 'uploading' | 'generating' | 'done' | 'error';

export const tryOnState = writable<TryOnState>('idle');
export const bodyImageURL = writable<string | null>(null);  // persists across try-ons
export const resultURL = writable<string | null>(null);
export const errorMessage = writable<string | null>(null);
export const progress = writable(0);

export function resetTryOn() {
  tryOnState.set('idle');
  resultURL.set(null);
  errorMessage.set(null);
  progress.set(0);
}
