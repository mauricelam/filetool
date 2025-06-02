import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Graphviz } from '@hpcc-js/wasm/graphviz';

const App = () => {
  const [dot, setDot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'file') {
        const fileContent = event.data.content;
        if (typeof fileContent === 'string') {
          setDot(fileContent);
          setError(null);
        } else {
          setError('Error: File content is not a string.');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    // Inform the parent window that the iframe is ready to receive messages
    window.parent.postMessage({ type: 'ready' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    if (dot && svgContainerRef.current) {
      Graphviz.load().then(graphviz => {
        try {
          const svg = graphviz.dot(dot);
          if (svgContainerRef.current) {
            svgContainerRef.current.innerHTML = svg;
          }
        } catch (e: any) {
          console.error('Error rendering Graphviz:', e);
          setError(`Error rendering Graphviz: ${e.message}`);
          if (svgContainerRef.current) {
            svgContainerRef.current.innerHTML = ''; // Clear previous graph
          }
        }
      }).catch(e => {
        console.error('Error loading Graphviz library:', e);
        setError(`Error loading Graphviz library: ${e.message}`);
      });
    }
  }, [dot]);

  if (error) {
    return <div style={{ color: 'red', padding: '10px' }}>{error}</div>;
  }

  if (!dot) {
    return <div style={{ padding: '10px' }}>Waiting for .dot file content...</div>;
  }

  return <div ref={svgContainerRef} style={{ width: '100%', height: '100%' }} />;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
} else {
  console.error('Root element not found');
}
