/// <reference types="vite/client" />

// Extend Vite env types with our custom variable(s)
interface ImportMetaEnv {
  readonly VITE_PAYMENTS_BASE_URL?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
