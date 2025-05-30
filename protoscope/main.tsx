import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// Declare the Go global object
declare const Go: any;
import * as protobuf from 'protobufjs'; // Using full version
// import 'protobufjs/ext/descriptor'; // May be needed if toDescriptor or FileDescriptorSet are not in light

// Declare protoscope on window
declare global {
    interface Window {
        protoscope?: {
            // Updated signature to accept main bytes, optional FDS bytes, and optional message name string
            protoscopeFile?: (mainFileBytes: Uint8Array, fdsBytes?: Uint8Array | null, messageName?: string | null) => string;
        };
    }
}

const ROOT = createRoot(document.getElementById('root')!);

const App: React.FC = () => {
    const [mainFile, setMainFile] = useState<File | null>(null);
    const [schemaFile, setSchemaFile] = useState<File | null>(null);
    const [messageName, setMessageName] = useState<string>('');
    const [output, setOutput] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<string>("Initializing...");
    const [wasmLoaded, setWasmLoaded] = useState<boolean>(false);

    // Effect for requesting the main file from parent
    useEffect(() => {
        if (window.parent) {
            window.parent.postMessage({ 'action': 'requestFile' });
        }
    }, []);

    // Effect for handling messages from parent (receiving main file)
    useEffect(() => {
        const messageHandler = (e: MessageEvent) => {
            if (e.data.action === 'respondFile' && e.data.file instanceof File) {
                setMainFile(e.data.file);
                setLoading("Main file received. Ready to process.");
            } else if (e.data.action === 'respondFile') {
                setError("Received 'respondFile' but data.file was not a File object.");
                setLoading(null);
            }
        };
        window.addEventListener('message', messageHandler);
        return () => window.removeEventListener('message', messageHandler);
    }, []);

    const handleSchemaFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSchemaFile(file);
            setOutput(null); 
            setError(null); 
            if (mainFile) setLoading("Schema file selected. Ready to process or enter message name.");
        } else {
            setSchemaFile(null); // Clear schema if no file is selected
        }
    };

    const handleMessageNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setMessageName(event.target.value);
        setOutput(null);
        setError(null);
        if (mainFile && schemaFile) setLoading("Ready to process with new message name.");
    };
    
    const loadWasm = useCallback(async () => {
        if (wasmLoaded) return true;
        setLoading("Loading WebAssembly module...");
        try {
            if (typeof Go === 'undefined') {
                const script = document.createElement('script');
                script.src = 'wasm_exec.js';
                document.head.appendChild(script);
                await new Promise<void>((resolve, reject) => {
                    script.onload = () => resolve();
                    script.onerror = reject;
                });
            }

            const go = new Go();
            const wasmResponse = await fetch('protoscope.wasm');
            if (!wasmResponse.ok) {
                throw new Error(`Failed to fetch Wasm: ${wasmResponse.statusText}`);
            }
            const wasmBytes = await wasmResponse.arrayBuffer();
            const mod = await WebAssembly.compile(wasmBytes);
            const inst = await WebAssembly.instantiate(mod, go.importObject);
            go.run(inst); 
            
            if (typeof window.protoscope?.protoscopeFile !== 'function') {
                 throw new Error('protoscopeFile function not found on window.protoscope. Ensure Wasm is loaded and initialized correctly.');
            }
            setWasmLoaded(true);
            setLoading(null);
            return true;
        } catch (err) {
            console.error('Error loading WASM:', err);
            const errorMessage = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            setError(`Error loading WASM: ${errorMessage}`);
            setLoading(null);
            return false;
        }
    }, [wasmLoaded]);


    const processFile = useCallback(async () => {
        if (!mainFile) {
            // This case should ideally not be hit if UI enables button appropriately
            setError("Main file not yet received or selected.");
            return;
        }

        setLoading("Processing file(s)...");
        setOutput(null);
        setError(null);

        const wasmReady = await loadWasm();
        if (!wasmReady) return;

        try {
            const mainFileArrayBuffer = await mainFile.arrayBuffer();
            const mainFileUint8Array = new Uint8Array(mainFileArrayBuffer);

            if (typeof window.protoscope?.protoscopeFile !== 'function') {
                throw new Error('protoscopeFile function not available. WASM module may not have initialized correctly.');
            }

            let result: string;

            if (schemaFile && messageName.trim()) {
                setLoading("Parsing .proto schema and processing...");
                const protoContents = await schemaFile.text();
                if (!messageName.trim()) {
                    setError("Message name is required when a schema file is provided.");
                    setLoading(null);
                    return;
                }
                try {
                    // protobuf.parse returns { package, imports, weakImports, syntax, root: Root }
                    const parsed = protobuf.parse(protoContents);
                    const root = parsed.root;
                    
                    // The 'toDescriptor' method might not be on the light version's Root.
                    // It's often on the full Root or needs protobufjs/ext/descriptor.
                    // For now, assuming it exists or will be polyfilled if build fails.
                    const descriptorMsg = root.toDescriptor("proto3");
                    
                    // Similarly, FileDescriptorSet might need to be imported or available.
                    // protobuf.common['google/protobuf/descriptor.proto'] might provide types.
                    // Or, if using full version: protobuf.FileDescriptorSet.encode(descriptorMsg).finish();
                    // For now, trying with direct access:
                    const fdsBytes = protobuf.FileDescriptorSet.encode(descriptorMsg).finish();
                    
                    result = window.protoscope.protoscopeFile(mainFileUint8Array, fdsBytes, messageName.trim());
                } catch (protoErr) {
                    console.error('Error processing .proto schema:', protoErr);
                    const errMsg = protoErr instanceof Error ? protoErr.message : String(protoErr);
                    setError(`Error processing .proto schema: ${errMsg}`);
                    setLoading(null);
                    return;
                }
            } else if (schemaFile && !messageName.trim()) {
                 setError("Message name is required when a schema file is selected. Processing without schema.");
                 result = window.protoscope.protoscopeFile(mainFileUint8Array, null, null);
            } else {
                setLoading("Processing without schema...");
                result = window.protoscope.protoscopeFile(mainFileUint8Array, null, null);
            }

            if (typeof result === 'string') {
                setOutput(result);
            } else {
                throw new Error(`Unexpected result type: ${typeof result}\n${JSON.stringify(result, null, 2)}`);
            }
        } catch (err) {
            console.error('Error processing file:', err);
            let errorMessageText = 'Error processing file(s).';
            if (err instanceof Error) {
                errorMessageText += `\n${err.name}: ${err.message}`;
                if (err.stack) errorMessageText += `\nStack: ${err.stack}`;
            } else {
                errorMessageText += `\n${String(err)}`;
            }
            setError(errorMessageText);
        } finally {
            setLoading(null);
        }
    }, [mainFile, schemaFile, loadWasm]);
    
    // Automatically attempt to load WASM on component mount if not already loaded.
    // This makes the UX smoother as WASM is likely ready when user interacts.
    useEffect(() => {
        loadWasm();
    }, [loadWasm]);

    // Automatically process when mainFile is set and WASM is loaded
    useEffect(() => {
        if (mainFile && wasmLoaded) {
            processFile();
        }
    }, [mainFile, wasmLoaded, processFile]);


    return (
        <div>
            <h1>Protoscope Viewer</h1>
            <div>
                <label htmlFor="schemafile">Optional .proto schema: </label>
                <input
                    type="file"
                    id="schemafile"
                    accept=".proto"
                    onChange={handleSchemaFileChange}
                    disabled={!!loading && loading !== "Initializing..." && !loading?.includes("Ready to process")}
                />
                {schemaFile && <p>Selected schema: {schemaFile.name}</p>}
            </div>
            <div>
                <label htmlFor="messagename">Message name (e.g., my.package.MyMessage): </label>
                <input
                    type="text"
                    id="messagename"
                    placeholder="my.package.MyMessage"
                    value={messageName}
                    onChange={handleMessageNameChange}
                    disabled={!schemaFile || (!!loading && loading !== "Initializing..." && !loading?.includes("Ready to process"))}
                    style={{ width: '300px' }}
                />
                {!messageName && schemaFile && <p style={{color: 'orange'}}>Message name is recommended when schema is selected.</p>}
            </div>
            
            {mainFile && wasmLoaded && (
                 <button onClick={processFile} disabled={!!loading && loading !== "Initializing..." && !loading?.includes("Ready to process")}>
                    Process {mainFile.name} {schemaFile && messageName ? `with ${schemaFile.name} (${messageName})` : (schemaFile ? `with ${schemaFile.name}` : '')}
                </button>
            )}

            {loading && <pre>Loading: {loading}</pre>}
            {error && <pre style={{ color: 'red' }}>Error: {error}</pre>}
            {output && <pre>{output}</pre>}
            
            {!mainFile && !loading && !error && <p>Waiting for main protobuf data file to be sent from the parent application...</p>}
        </div>
    );
};

ROOT.render(<App />);
