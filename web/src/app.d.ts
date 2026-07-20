// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }
}

// Type definitions for Vite environment variables
interface ImportMetaEnv {
    readonly VITE_API_BASE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

export {};
