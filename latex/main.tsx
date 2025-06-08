import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const LaTeXViewer: React.FC = () => {
  const [latexContent, setLatexContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SET_CONTENT') {
        setLatexContent(event.data.content);
        setError(null);
      }
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'GET_CONTENT' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const renderLatex = () => {
    if (!latexContent) {
      return <p>No LaTeX content loaded.</p>;
    }
    try {
      const html = katex.renderToString(latexContent, {
        throwOnError: false,
        output: 'htmlAndMathml'
      });
      return <div dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (e: any) {
      setError(`Error rendering LaTeX: ${e.message}`);
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

ReactDOM.render(<LaTeXViewer />, document.getElementById('root'));
