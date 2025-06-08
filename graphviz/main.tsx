import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Graphviz } from 'graphviz-react';

const App = () => {
  const [dot, setDot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.action === 'respondFile') {
        const file = event.data.file;
        if (file instanceof File) {
          file.text().then(content => {
            setDot(content);
            setError(null);
          }).catch(err => {
            setError(`Error reading file: ${err.message}`);
          });
        } else {
          setError('Error: Received invalid file object.');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    // Inform the parent window that we're ready to receive a file
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
