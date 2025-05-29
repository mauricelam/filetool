// Declare the Go global object
declare const Go: any;

async function main() {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    const outputPre = document.getElementById('output') as HTMLPreElement;

    if (!fileInput || !outputPre) {
        console.error('Required HTML elements not found.');
        return;
    }

    // Fetch and load wasm_exec.js
    try {
        const script = document.createElement('script');
        // Assuming wasm_exec.js is available at the root, like other viewers.
        // This path might need adjustment based on actual deployment.
        script.src = '/wasm_exec.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
        });
    } catch (err) {
        console.error('Failed to load wasm_exec.js:', err);
        outputPre.textContent = `Failed to load wasm_exec.js: ${err}`;
        return;
    }

    if (typeof Go === 'undefined') {
        outputPre.textContent = 'Go object not found after loading wasm_exec.js. Wasm execution cannot proceed.';
        return;
    }

    const go = new Go();
    let mod: WebAssembly.Module, inst: WebAssembly.Instance;

    try {
        const wasmResponse = await fetch('protoscope.wasm'); // Relative to protoscopeviewer/
        if (!wasmResponse.ok) {
            throw new Error(`Failed to fetch Wasm: ${wasmResponse.statusText}`);
        }
        const wasmBytes = await wasmResponse.arrayBuffer();
        mod = await WebAssembly.compile(wasmBytes);
        inst = await WebAssembly.instantiate(mod, go.importObject);
        go.run(inst); // Run the Wasm instance to initialize Go environment
    } catch (err) {
        console.error('Wasm initialization failed:', err);
        outputPre.textContent = `Wasm initialization failed: ${err}`;
        return;
    }

    fileInput.addEventListener('change', async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (!files || files.length === 0) {
            outputPre.textContent = 'No file selected.';
            return;
        }

        const file = files[0];
        outputPre.textContent = 'Processing...';

        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Ensure the Go Wasm function is available
            if (typeof (window as any).protoscopeviewer?.protoscopeFile !== 'function') {
                throw new Error('protoscopeFile function not found on window.protoscopeviewer. Ensure Wasm is loaded and initialized.');
            }

            const result = (window as any).protoscopeviewer.protoscopeFile(uint8Array);

            if (typeof result === 'string') {
                outputPre.textContent = result;
            } else {
                // Handle cases where the result might not be a direct string, e.g., if it's an error object
                outputPre.textContent = `Unexpected result type: ${typeof result}\n${JSON.stringify(result, null, 2)}`;
            }

        } catch (err) {
            console.error('Error processing file:', err);
            let errorMessage = 'Error processing file.';
            if (err instanceof Error) {
                errorMessage += `\n${err.name}: ${err.message}`;
                if (err.stack) {
                    errorMessage += `\nStack: ${err.stack}`;
                }
            } else {
                errorMessage += `\n${String(err)}`;
            }
            outputPre.textContent = errorMessage;
        }
    });

    outputPre.textContent = 'Protoscope Wasm module loaded. Select a .pb file.';
}

main().catch(err => {
    console.error("Error in main function:", err);
    const outputPre = document.getElementById('output') as HTMLPreElement;
    if (outputPre) {
        outputPre.textContent = `Critical error in main function: ${err}`;
    }
});
