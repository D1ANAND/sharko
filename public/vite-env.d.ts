/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_CUSTODY_ADDRESS: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
