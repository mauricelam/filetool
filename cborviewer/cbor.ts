// Import the wasm-pack generated JS and its default init function from the pkg directory
import init, * as wasm from './cbor-diag-wasm/pkg/cbor-diag-wasm.js';

let initPromise: Promise<unknown> | null = null;

async function ensureInitialized() {
    if (!initPromise) {
        // Provide the .wasm URL to the init function for reliable loading under bundlers
        const wasmUrl = new URL('./cbor-diag-wasm_bg.wasm', import.meta.url);
        initPromise = init(wasmUrl);
    }
    await initPromise;
}

export async function processData(data: Uint8Array): Promise<{ standard: string, verbose: string }> {
    await ensureInitialized();
    const standard = wasm.to_diag(data);
    const verbose = wasm.to_verbose_diag(data);
    return { standard, verbose };
}
