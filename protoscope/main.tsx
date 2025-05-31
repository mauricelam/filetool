import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Declare the Go global object
declare const Go: any;
import * as protobuf from 'protobufjs'; // Using full version
import 'protobufjs/ext/descriptor'; // Import the descriptor extension
import { FileDescriptorSet } from 'protobufjs/ext/descriptor';

// Declare protoscope on window
declare global {
    interface Window {
        protoscope?: {
            // Updated signature to accept main bytes, optional FDS bytes, and optional message name string
            protoscopeFile?: (mainFileBytes: Uint8Array, fdsBytes?: Uint8Array | null, messageName?: string | null) => string;
            protoscopeFileAsTextproto?: (mainFileBytes: Uint8Array, fdsBytes: Uint8Array, messageName: string) => string;
        };
    }
}

const ROOT = createRoot(document.getElementById('root')!);

const App: React.FC = () => {
    const [mainFile, setMainFile] = useState<File | null>(null);
    const [mainFileUint8Array, setMainFileUint8Array] = useState<Uint8Array | null>(null);
    const [schemaFile, setSchemaFile] = useState<File | null>(null);
    const [fdsBytes, setFdsBytes] = useState<Uint8Array | null>(null);
    const [messageName, setMessageName] = useState<string>('');
    const [messageTypes, setMessageTypes] = useState<string[]>([]);
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
        const messageHandler = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile' && e.data.file instanceof File) {
                setMainFile(e.data.file);
                try {
                    const arrayBuffer = await e.data.file.arrayBuffer();
                    setMainFileUint8Array(new Uint8Array(arrayBuffer));
                    setLoading("Main file received. Ready to process.");
                } catch (err) {
                    setError(`Error reading main file: ${err instanceof Error ? err.message : String(err)}`);
                    setLoading(null);
                }
            } else if (e.data.action === 'respondFile') {
                setError("Received 'respondFile' but data.file was not a File object.");
                setLoading(null);
            }
        };
        window.addEventListener('message', messageHandler);
        return () => window.removeEventListener('message', messageHandler);
    }, []);

    const handleSchemaFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSchemaFile(file);
            setOutput(null);
            setError(null);
            setFdsBytes(null); // Reset fdsBytes
            setMessageTypes([]); // Reset message types
            setMessageName(''); // Reset selected message

            try {
                const protoContents = await file.text();
                const parsed = protobuf.parse(protoContents);
                const root = parsed.root;
                const fds = (root as any).toDescriptor();
                const encodedFdsBytes = FileDescriptorSet.encode(fds).finish();
                setFdsBytes(encodedFdsBytes);

                // Extract all message types from the root
                const types: string[] = [];
                const processNested = (nested: any) => {
                    if (nested instanceof protobuf.Type) {
                        types.push(nested.fullName);
                    }
                    if (nested.nestedArray) {
                        nested.nestedArray.forEach(processNested);
                    }
                };

                root.nestedArray.forEach(processNested);
                console.log('Found message types:', types); // Debug log

                setMessageTypes(types);
                // Automatically select the first message type if available
                if (types.length > 0) {
                    setMessageName(types[0]);
                }
                if (mainFile) setLoading("Schema file selected. Ready to process or select message type.");
            } catch (err) {
                console.error('Error parsing schema:', err); // Debug log
                setError(`Error parsing schema file: ${err instanceof Error ? err.message : String(err)}`);
                setFdsBytes(null); // Clear fdsBytes on error
                setLoading(null);
            }
        } else {
            setSchemaFile(null);
            setFdsBytes(null);
            setMessageTypes([]);
            setMessageName('');
        }
    };

    const handleMessageNameChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedMessage = event.target.value;
        setMessageName(selectedMessage);
        setOutput(null);
        setError(null);

        if (selectedMessage && mainFile && schemaFile) {
            setLoading("Processing with selected message type...");
            processFile();
        }
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
        if (!mainFile) { // Early exit if mainFile isn't there
            setError("Main file not yet received or selected.");
            return;
        }

        setLoading("Processing file(s)...");
        setOutput(null);
        setError(null);

        const wasmReady = await loadWasm();
        if (!wasmReady) return;

        let currentMainFileUint8Array = mainFileUint8Array;
        if (!currentMainFileUint8Array && mainFile) { // Ensure mainFileUint8Array is populated
            try {
                const arrayBuffer = await mainFile.arrayBuffer();
                currentMainFileUint8Array = new Uint8Array(arrayBuffer);
                setMainFileUint8Array(currentMainFileUint8Array);
            } catch (err) {
                setError(`Error reading main file for processing: ${err instanceof Error ? err.message : String(err)}`);
                setLoading(null);
                return;
            }
        }

        if (!currentMainFileUint8Array) {
            setError("Main file data could not be read.");
            setLoading(null);
            return;
        }


        try {
            if (typeof window.protoscope?.protoscopeFile !== 'function') {
                throw new Error('protoscopeFile function not available. WASM module may not have initialized correctly.');
            }

            let result: string;

            if (schemaFile && messageName && fdsBytes) { // Use fdsBytes from state
                setLoading("Processing with schema...");
                result = window.protoscope.protoscopeFile(currentMainFileUint8Array, fdsBytes, messageName);
            } else {
                setLoading("Processing without schema...");
                result = window.protoscope.protoscopeFile(currentMainFileUint8Array, null, null);
            }

            if (typeof result === 'string' && !result.startsWith("Error:")) {
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
    }, [mainFile, schemaFile, messageName, loadWasm]);

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px', fontFamily: 'Roboto, Helvetica, Arial, sans-serif' }}>
            <h1>Protoscope Viewer</h1>
            <div style={{
                padding: '20px',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                height: 'fit-content'
            }}>
                <div style={{ marginBottom: '20px' }}>
                    <label htmlFor="schemafile" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                        .proto schema:
                    </label>
                    <input
                        type="file"
                        id="schemafile"
                        accept=".proto"
                        onChange={handleSchemaFileChange}
                        disabled={!!loading && loading !== "Initializing..." && !loading?.includes("Ready to process")}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {schemaFile && (
                    <div>
                        <label htmlFor="messagename" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                            Message type:
                        </label>
                        <select
                            id="messagename"
                            value={messageName}
                            onChange={handleMessageNameChange}
                            disabled={!schemaFile || (!!loading && loading !== "Initializing..." && !loading?.includes("Ready to process"))}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                backgroundColor: 'white'
                            }}
                        >
                            <option value="">Select a message type</option>
                            {messageTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        {!messageName && messageTypes.length > 0 && (
                            <p style={{ color: '#f90', marginTop: '8px', fontSize: '0.9em' }}>
                                Please select a message type from the dropdown.
                            </p>
                        )}
                        {messageTypes.length === 0 && (
                            <p style={{ color: '#f90', marginTop: '8px', fontSize: '0.9em' }}>
                                No message types found in the schema file.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {loading && <pre>Loading: {loading}</pre>}
            {error && <pre style={{ color: 'red' }}>Error: {error}</pre>}
            {output && (
                <SyntaxHighlighter
                    language="python"
                    style={docco}
                    customStyle={{
                        backgroundColor: '#f5f5f5',
                        padding: '1em',
                        borderRadius: '4px',
                    }}
                >
                    {output}
                </SyntaxHighlighter>
            )}
            {!mainFile && !loading && !error && <p>Waiting for main protobuf data file to be sent from the parent application...</p>}

            <button
                onClick={handleDownloadTextproto}
                disabled={!mainFileUint8Array || !fdsBytes || !messageName || !!loading}
                style={{
                    padding: '10px 15px',
                    backgroundColor: (!mainFileUint8Array || !fdsBytes || !messageName || !!loading) ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (!mainFileUint8Array || !fdsBytes || !messageName || !!loading) ? 'not-allowed' : 'pointer',
                    marginTop: '10px'
                }}
            >
                Download as Textproto
            </button>
        </div>
    );

    const handleDownloadTextproto = async () => {
        console.log("Download textproto clicked");

        if (!mainFileUint8Array || !fdsBytes || !messageName) {
            setError("Cannot download textproto: main file, schema, or message name is missing.");
            return;
        }
        const wasmReady = await loadWasm();
        if (!wasmReady) {
            setError("WASM module not loaded. Cannot download textproto.");
            return;
        }

        setLoading("Generating textproto...");
        try {
            if (!window.protoscope?.protoscopeFileAsTextproto) {
                setError("Textproto download function is not available (protoscopeFileAsTextproto missing).");
                setLoading(null);
                return;
            }
            // Ensure states are directly accessed here
            const textprotoContent = window.protoscope.protoscopeFileAsTextproto(mainFileUint8Array, fdsBytes, messageName);

            if (typeof textprotoContent === 'string' && !textprotoContent.startsWith("Error:")) {
                const blob = new Blob([textprotoContent], { type: 'text/plain' });
                const href = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = href;
                a.download = `${messageName || 'message'}.textproto`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(href);
                setError(null); // Clear previous errors
            } else {
                setError(textprotoContent || "Failed to generate textproto.");
            }
        } catch (err) {
            console.error("Error downloading textproto:", err);
            setError(`Error during textproto download: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(null);
        }
    };
};

ROOT.render(<App />);
