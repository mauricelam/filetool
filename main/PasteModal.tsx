import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

export type PasteMode = 'raw' | 'hex' | 'base64';

interface PasteModalProps {
    text: string;
    onClose: () => void;
    onComplete: (file: File) => void;
}

export function PasteModal({ text, onClose, onComplete }: PasteModalProps) {
    const [filename, setFilename] = useState('pasted.txt');
    const [mode, setMode] = useState<PasteMode>('raw');
    const [error, setError] = useState<string | null>(null);

    const validation = useMemo(() => {
        const results = {
            raw: { valid: true, error: null as string | null },
            hex: { valid: false, error: null as string | null },
            base64: { valid: false, error: null as string | null }
        };

        // Hex validation
        const cleanHex = text.replace(/[^0-9a-fA-F]/g, '');
        const hasInvalidChars = /[^0-9a-fA-F\s\.,:;\-_]/.test(text);

        if (hasInvalidChars) {
            results.hex.error = "Contains non-hex and non-punctuation characters";
        } else if (cleanHex.length === 0) {
            results.hex.error = "No hex characters found";
        } else if (cleanHex.length % 2 !== 0) {
            results.hex.error = "Invalid Hex: length must be even";
        } else {
            results.hex.valid = true;
        }

        // Base64 validation
        try {
            atob(text.replace(/\s/g, ''));
            results.base64.valid = true;
        } catch (e) {
            results.base64.error = "Invalid Base64 format";
        }

        return results;
    }, [text]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleAction = () => {
        setError(null);
        try {
            let blob: Blob;
            if (mode === 'raw') {
                blob = new Blob([text], { type: 'text/plain' });
            } else if (mode === 'hex') {
                const cleanHex = text.replace(/[^0-9a-fA-F]/g, '');
                if (cleanHex.length % 2 !== 0) {
                    throw new Error('Invalid Hex: length must be even');
                }
                const bytes = new Uint8Array(cleanHex.length / 2);
                for (let i = 0; i < cleanHex.length; i += 2) {
                    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
                }
                blob = new Blob([bytes], { type: 'application/octet-stream' });
            } else if (mode === 'base64') {
                try {
                    const binaryString = atob(text.replace(/\s/g, ''));
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    blob = new Blob([bytes], { type: 'application/octet-stream' });
                } catch (e) {
                    throw new Error('Invalid Base64: ' + (e instanceof Error ? e.message : String(e)));
                }
            } else {
                throw new Error('Unsupported mode');
            }

            const file = new File([blob], filename, {
                type: mode === 'raw' ? 'text/plain' : 'application/octet-stream',
                lastModified: Date.now()
            });
            onComplete(file);
        } catch (e: any) {
            setError(e.message);
        }
    };

    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return null;

    return createPortal(
        <div
            className="modal-backdrop"
            onClick={handleBackdropClick}
            role="presentation"
        >
            <div
                className="modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="paste-modal-title"
            >
                <div className="modal-header">
                    <h2 id="paste-modal-title">Pasted Text Options</h2>
                    <button
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
                            <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
                        </svg>
                    </button>
                </div>

                <div className="modal-body">
                    <div className="preview-text">
                        {text.length > 500 ? text.substring(0, 500) + '...' : text}
                    </div>

                    <div className="input-group">
                        <label htmlFor="filename-input">Filename</label>
                        <input
                            id="filename-input"
                            type="text"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                        />
                    </div>

                    <div className="input-group">
                        <label>Treat as</label>
                        <div className="radio-group" role="radiogroup" aria-labelledby="paste-modal-title">
                            <label className={`radio-option ${!validation.raw.valid ? 'disabled' : ''}`}>
                                <input
                                    type="radio"
                                    name="paste-mode"
                                    value="raw"
                                    checked={mode === 'raw'}
                                    onChange={() => setMode('raw')}
                                    disabled={!validation.raw.valid}
                                />
                                Raw Text
                            </label>
                            <label
                                className={`radio-option ${!validation.hex.valid ? 'disabled' : ''}`}
                                title={validation.hex.error || ''}
                            >
                                <input
                                    type="radio"
                                    name="paste-mode"
                                    value="hex"
                                    checked={mode === 'hex'}
                                    onChange={() => setMode('hex')}
                                    disabled={!validation.hex.valid}
                                />
                                Hex
                            </label>
                            <label
                                className={`radio-option ${!validation.base64.valid ? 'disabled' : ''}`}
                                title={validation.base64.error || ''}
                            >
                                <input
                                    type="radio"
                                    name="paste-mode"
                                    value="base64"
                                    checked={mode === 'base64'}
                                    onChange={() => setMode('base64')}
                                    disabled={!validation.base64.valid}
                                />
                                Base64
                            </label>
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleAction}>Add File</button>
                </div>
            </div>
        </div>,
        modalRoot
    );
}
