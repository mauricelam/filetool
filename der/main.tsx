import React, { useState, useCallback, useEffect, useRef } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { createRoot } from 'react-dom/client';
import { RequestFileMessage, RespondFileMessage } from 'common/messages';

declare global {
  interface Window {
    derToAscii: (data: Uint8Array) => string;
    Go: any;
  }
}

export function DerAsciiViewer() {
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const pendingFileRef = useRef<File | null>(null);
  const wasmLoadedRef = useRef<boolean>(false);

  const processFile = useCallback(async (file: File) => {
    try {
      // Read file as ArrayBuffer and convert to Uint8Array
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Check if derToAscii exists
      if (typeof window.derToAscii !== 'function') {
        throw new Error('WebAssembly function derToAscii is not available');
      }

      // Call the Go function with the ArrayBuffer
      const result = window.derToAscii(uint8Array);
      setOutput(result);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setOutput('');
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadWasm = async () => {
      try {
        const go = new window.Go();
        const response = await fetch('der.wasm');
        if (!response.ok) {
          throw new Error(`Failed to fetch der.wasm: ${response.status} ${response.statusText}`);
        }
        const result = await WebAssembly.instantiateStreaming(response, go.importObject);
        if (!active) return;
        go.run(result.instance);
        wasmLoadedRef.current = true;
        setLoading(false);

        // If a file was received before WASM loaded, process it now
        if (pendingFileRef.current) {
          processFile(pendingFileRef.current);
          pendingFileRef.current = null;
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load WebAssembly module');
        setLoading(false);
      }
    };
    loadWasm();
    return () => { active = false; };
  }, [processFile]);

  useEffect(() => {
    // Request file when component mounts if in iframe
    if (window.parent !== window) {
      window.parent.postMessage({ action: 'requestFile' }, '*');
    }

    // Listen for file response
    const messageHandler = (e: MessageEvent<RespondFileMessage>) => {
      if (e.data.action === 'respondFile') {
        if (wasmLoadedRef.current) {
          processFile(e.data.file);
        } else {
          pendingFileRef.current = e.data.file;
        }
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [processFile]);

  if (loading && !error) {
    return <div id="der-loading">Loading...</div>;
  }

  return (
    <div className="der-ascii-viewer">
      <h2>DER ASCII Viewer</h2>

      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}

      {output && (
        <div className="output">
          <SyntaxHighlighter
            language="python"
            style={docco}
            customStyle={{
              backgroundColor: '#f5f5f5',
              padding: '1em',
              borderRadius: '4px',
              overflow: 'auto',
            }}
          >
            {output}
          </SyntaxHighlighter>
        </div>
      )}

      <style>
        {`
          .der-ascii-viewer {
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }

          h2 {
            color: #333;
            margin-bottom: 10px;
          }

          p {
            color: #666;
            margin-bottom: 20px;
          }

          .error {
            color: #d32f2f;
            padding: 10px;
            background-color: #ffebee;
            border-radius: 4px;
            margin-bottom: 20px;
          }

          .output {
            margin-top: 20px;
          }

          .output h3 {
            color: #333;
            margin-bottom: 10px;
          }
        `}
      </style>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const reactRoot = createRoot(container);
  reactRoot.render(<DerAsciiViewer />);
}
