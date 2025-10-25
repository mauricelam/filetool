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
    const [className, setClassName] = useState('');
    const [deobfuscatedClassName, setDeobfuscatedClassName] = useState('');
    const [methodClassName, setMethodClassName] = useState('');
    const [methodName, setMethodName] = useState('');
    const [deobfuscatedMethodName, setDeobfuscatedMethodName] = useState('');
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

    const handleDeobfuscateClass = async () => {
        if (!mappingFile) {
            setError('Mapping file not loaded');
            return;
        }
        const result = await deobfuscateClass(mappingFile, className);
        setDeobfuscatedClassName(result);
    };

    const handleDeobfuscateMethod = async () => {
        if (!mappingFile) {
            setError('Mapping file not loaded');
            return;
        }
        const result = await deobfuscateMethod(mappingFile, methodClassName, methodName);
        setDeobfuscatedMethodName(result);
    };

    return (
        <div>
            <h3>Proguard Deobfuscator</h3>
            <div>
                <h4>Deobfuscate Class</h4>
                <input
                    type="text"
                    placeholder="Obfuscated class name"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                />
                <button onClick={handleDeobfuscateClass}>Deobfuscate</button>
                <p>Deobfuscated: {deobfuscatedClassName}</p>
            </div>
            <div>
                <h4>Deobfuscate Method</h4>
                <input
                    type="text"
                    placeholder="Obfuscated class name"
                    value={methodClassName}
                    onChange={(e) => setMethodClassName(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Obfuscated method name"
                    value={methodName}
                    onChange={(e) => setMethodName(e.target.value)}
                />
                <button onClick={handleDeobfuscateMethod}>Deobfuscate</button>
                <p>Deobfuscated: {deobfuscatedMethodName}</p>
            </div>
            <h4>Deobfuscate Stack Trace</h4>
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
            <h3>Mapping Rules</h3>
            <pre>{rules}</pre>
        </div>
    );
};

const container = document.getElementById('output');
if (container) {
    const root = createRoot(container);
    root.render(<ProguardViewer />);
}
