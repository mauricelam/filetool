import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const LaTeXViewer: React.FC<{
  latexContent: string;
  error: string | null;
}> = ({ latexContent, error }) => {
  const renderLatex = () => {
    if (!latexContent) {
      return <p>No LaTeX content loaded.</p>;
    }
    try {
      const html = katex.renderToString(latexContent, {
        output: 'html'
      });
      return <div dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (e: any) {
      return <pre style={{ color: 'red' }}>{`Error rendering LaTeX: ${e.message}\n${latexContent}`}</pre>;
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      {error && <pre style={{ color: 'red' }}>{error}</pre>}
      {renderLatex()}
    </div>
  );
};

const App: React.FC = () => {
  const [latexContent, setLatexContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Request file when component mounts
    if (window.parent) {
      window.parent.postMessage({ action: 'requestFile' }, '*');
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.action === 'respondFile') {
        const reader = new FileReader();

        reader.onload = (e) => {
          const content = e.target?.result as string;
          setLatexContent(content);
          setError(null);
        };

        reader.onerror = () => {
          setError('Error reading file');
        };

        reader.readAsText(message.file);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return <LaTeXViewer latexContent={latexContent} error={error} />;
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
