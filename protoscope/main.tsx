import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Declare the Go global object
declare const Go: any;

// Request file from parent window
if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' });
}

// Set up message handler
window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file);
    }
};

const ROOT = createRoot(document.getElementById('root')!);

async function handleFile(file: File) {
    ROOT.render(<div><pre>Loading...</pre></div>);

    try {
        // Load wasm_exec.js if not already loaded
        if (typeof Go === 'undefined') {
            const script = document.createElement('script');
            script.src = 'wasm_exec.js';
            document.head.appendChild(script);
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });
        }

        // Initialize Go and load WASM
        const go = new Go();
        const wasmResponse = await fetch('protoscope.wasm');
        if (!wasmResponse.ok) {
            throw new Error(`Failed to fetch Wasm: ${wasmResponse.statusText}`);
        }
        const wasmBytes = await wasmResponse.arrayBuffer();
        const mod = await WebAssembly.compile(wasmBytes);
        const inst = await WebAssembly.instantiate(mod, go.importObject);
        go.run(inst);

        // Process the file
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        if (typeof (window as any).protoscope?.protoscopeFile !== 'function') {
            throw new Error('protoscopeFile function not found on window.protoscope. Ensure Wasm is loaded and initialized.');
        }

        const result = (window as any).protoscope.protoscopeFile(uint8Array);

        if (typeof result === 'string') {
            ROOT.render(<div><pre>{result}</pre></div>);
        } else {
            ROOT.render(<div><pre>Unexpected result type: {typeof result}\n{JSON.stringify(result, null, 2)}</pre></div>);
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
        ROOT.render(<div><pre>{errorMessage}</pre></div>);
    }
}

// Initial render
ROOT.render(<div>Loading Protoscope...</div>);
