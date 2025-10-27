import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { deobfuscateStackTrace, getRules, deobfuscateClass, deobfuscateMethod } from './proguard';

// Request file from parent window
if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' });
}

const ProguardViewer: React.FC = () => {
    const [mappingFile, setMappingFile] = useState<string | null>(null);
    const [stackTrace, setStackTrace] = useState('');
    const [deobfuscatedTrace, setDeobfuscatedTrace] = useState('');
    const [singleName, setSingleName] = useState('');
    const [deobfuscatedSingleName, setDeobfuscatedSingleName] = useState('');
    const [rules, setRules] = useState('');
    const [error, setError] = useState<string>('');
    const [isDeobfuscating, setIsDeobfuscating] = useState(false);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                try {
                    const file = e.data.file as File;
                    const text = await file.text();
                    setMappingFile(text);
                    const rules = await getRules(text);
                    setRules(rules);
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

    useEffect(() => {
        const deobfuscate = async () => {
            if (!mappingFile || !singleName) {
                setDeobfuscatedSingleName('');
                return;
            }

            try {
                if (singleName.includes('.')) {
                    const parts = singleName.split('.');
                    const className = parts.slice(0, -1).join('.');
                    const methodName = parts.slice(-1)[0];
                    if (className && methodName) {
                        const result = await deobfuscateMethod(mappingFile, className, methodName);
                        setDeobfuscatedSingleName(result);
                    } else {
                        setDeobfuscatedSingleName('');
                    }
                } else {
                    const result = await deobfuscateClass(mappingFile, singleName);
                    setDeobfuscatedSingleName(result);
                }
            } catch (e: any) {
                setDeobfuscatedSingleName(`Error: ${e?.message ?? String(e)}`);
            }
        };

        const handler = setTimeout(() => {
            deobfuscate();
        }, 300); // Shorter debounce time for better UX

        return () => {
            clearTimeout(handler);
        };
    }, [singleName, mappingFile]);

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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
            <h3 style={{ textAlign: 'center', margin: '1rem' }}>Proguard Deobfuscator</h3>
            <div style={{ display: 'flex', flex: 1 }}>
                <div style={{ flex: 1, padding: '1rem', borderRight: '1px solid #ccc' }}>
                    <h4>Deobfuscate Class/Method</h4>
                    <input
                        type="text"
                        placeholder="Obfuscated name"
                        value={singleName}
                        onChange={(e) => setSingleName(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                    />
                    <p>Deobfuscated: {deobfuscatedSingleName}</p>
                </div>
                <div style={{ flex: 2, padding: '1rem' }}>
                    <h4>Deobfuscate Stack Trace</h4>
                    <textarea
                        rows={10}
                        placeholder="Paste stack trace here"
                        value={stackTrace}
                        onChange={(e) => setStackTrace(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                    />
                    <button onClick={handleDeobfuscate} disabled={isDeobfuscating} style={{ padding: '0.5rem 1rem' }}>
                        {isDeobfuscating ? 'Deobfuscating...' : 'Deobfuscate'}
                    </button>
                    {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
                    <pre style={{ background: '#f4f4f4', padding: '1rem', marginTop: '1rem' }}>{deobfuscatedTrace}</pre>
                </div>
            </div>
            <div style={{ flex: 1, padding: '1rem', borderTop: '1px solid #ccc' }}>
                <h3>Mapping Rules</h3>
                <pre style={{ background: '#f4f4f4', padding: '1rem', height: '300px', overflowY: 'auto' }}>{rules}</pre>
            </div>
        </div>
    );
};

const container = document.getElementById('output');
if (container) {
    const root = createRoot(container);
    root.render(<ProguardViewer />);
}
