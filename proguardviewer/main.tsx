import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { deobfuscateStackTrace } from './proguard';

// Request file from parent window
if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' });
}

const ProguardViewer: React.FC = () => {
    const [mappingFile, setMappingFile] = useState<string | null>(null);
    const [stackTrace, setStackTrace] = useState('');
    const [deobfuscatedTrace, setDeobfuscatedTrace] = useState('');
    const [error, setError] = useState<string>('');
    const [isDeobfuscating, setIsDeobfuscating] = useState(false);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                try {
                    const file = e.data.file as File;
                    const text = await file.text();
                    setMappingFile(text);
                } catch (err) {
                    setError(`Error reading file: ${err.message}`);
                }
            }
        };
        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const handleDeobfuscate = async () => {
        if (!mappingFile) {
            setError('Mapping file not loaded');
            return;
        }

        setIsDeobfuscating(true);
        setError('');
        setDeobfuscatedTrace('');

        try {
            const result = await deobfuscateStackTrace(mappingFile, stackTrace);
            setDeobfuscatedTrace(result);
        } catch (e: any) {
            setError(`Error deobfuscating: ${e?.message ?? String(e)}`);
        } finally {
            setIsDeobfuscating(false);
        }
    };

    return (
        <div>
            <h3>Proguard Deobfuscator</h3>
            <textarea
                rows={10}
                cols={80}
                placeholder="Paste stack trace here"
                value={stackTrace}
                onChange={(e) => setStackTrace(e.target.value)}
            />
            <br />
            <button onClick={handleDeobfuscate} disabled={isDeobfuscating}>
                {isDeobfuscating ? 'Deobfuscating...' : 'Deobfuscate'}
            </button>
            {error && <div style={{ color: 'red' }}>{error}</div>}
            <pre>{deobfuscatedTrace}</pre>
        </div>
    );
};

const container = document.getElementById('output');
if (container) {
    const root = createRoot(container);
    root.render(<ProguardViewer />);
}
