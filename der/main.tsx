import React, { useState, useCallback, useEffect } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { createRoot } from 'react-dom/client';

declare global {
  interface Window {
    derToAscii: (data: ArrayBuffer) => string;
  }
}

function DerAsciiViewer() {
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleFile = useCallback(async (file: File) => {
    try {
      // Read file as ArrayBuffer and convert to Uint8Array
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
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
    // Request file when component mounts if in iframe
    if (window.parent !== window) {
      window.parent.postMessage({ action: 'requestFile' }, '*');
    }

    // Listen for file response
    const messageHandler = (e: MessageEvent) => {
      if (e.data.action === 'respondFile') {
        handleFile(e.data.file);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [handleFile]);

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
            language="text"
            style={docco}
            customStyle={{
              backgroundColor: '#f5f5f5',
              padding: '1em',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '500px'
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