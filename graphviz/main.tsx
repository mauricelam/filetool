import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Graphviz } from 'graphviz-react';
import { RespondFileMessage, safeReadText, formatBytes } from '@filetool/common';

const App = () => {
  const [dot, setDot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [totalSize, setTotalSize] = useState<number>(0);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent<RespondFileMessage>) => {
      if (event.data && event.data.action === 'respondFile') {
        const file = event.data.file;
        if (file instanceof File) {
          try {
            const { text: content, isTruncated, totalSize } = await safeReadText(file);
            setIsTruncated(isTruncated);
            setTotalSize(totalSize);
            setDot(content);
            setError(null);
          } catch (err: any) {
            setError(`Error reading file: ${err?.message || err}`);
          }
        } else {
          setError('Error: Received invalid file object.');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    if (window.parent) {
      window.parent.postMessage({ action: 'requestFile' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  if (error) {
    return <div style={{ color: 'red', padding: '10px' }}>{error}</div>;
  }

  if (!dot) {
    return <div style={{ padding: '10px' }}>Waiting for .dot file content...</div>;
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative'
    }}>
      {isTruncated && (
        <div id="truncation-warning" style={{
          padding: '8px 12px',
          backgroundColor: '#fff3cd',
          color: '#856404',
          border: '1px solid #ffeeba',
          borderRadius: '4px',
          margin: '10px',
          fontSize: '13px',
          fontFamily: 'sans-serif'
        }}>
          ⚠️ File is too large ({formatBytes(totalSize)}). Showing preview of loaded portion.
        </div>
      )}
      <Graphviz
        dot={dot}
        options={{
          width: '100%',
          height: '100%',
          fit: true,
          zoom: true
        }}
      />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
} else {
  console.error('Root element not found');
}
