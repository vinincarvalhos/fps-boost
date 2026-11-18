/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  /** License server base URL, e.g. https://fps-boost.vercel.app (set in .env / .env.local) */
  readonly MAIN_VITE_LICENSE_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
