import { createRoot } from 'react-dom/client'
import React, { useState } from 'react';

const ROOT = createRoot(document.getElementById('root')!)

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file, e.data.additionalFiles || [])
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

async function handleFile(file: File, additionalFiles: File[]) {
    ROOT.render(<ConcatenateView files={[file, ...additionalFiles]} />)
}

const ConcatenateView: React.FC<{ files: File[] }> = ({ files }) => {
    const [filename, setFilename] = useState('concatenated.bin');
    const [isConcatenating, setIsConcatenating] = useState(false);

    const handleConcatenate = async () => {
        setIsConcatenating(true);
        try {
            const blobs: Blob[] = [];
            for (const file of files) {
                blobs.push(file);
            }
            const combinedBlob = new Blob(blobs);
            const combinedFile = new File([combinedBlob], filename, { type: 'application/octet-stream' });

            window.parent?.postMessage({
                action: 'openFile',
                file: combinedFile
            }, "/", [await combinedFile.arrayBuffer()]);
        } catch (error) {
            console.error('Error concatenating files:', error);
            alert('Failed to concatenate files.');
        } finally {
            setIsConcatenating(false);
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Concatenate Files</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontWeight: 'bold' }}>Output Filename</label>
                    <input
                        type="text"
                        value={filename}
                        onChange={e => setFilename(e.target.value)}
                        style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                </div>
                <div style={{ marginTop: '10px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Files to concatenate ({files.length}):</div>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px', padding: '8px' }}>
                        {files.map((f, i) => (
                            <div key={i} style={{ fontSize: '14px', padding: '4px 0', borderBottom: i < files.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                {f.name} <span style={{ color: '#888', fontSize: '12px' }}>({(f.size / 1024).toFixed(2)} KB)</span>
                            </div>
                        ))}
                    </div>
                </div>
                <button
                    onClick={handleConcatenate}
                    disabled={isConcatenating}
                    style={{
                        padding: '12px',
                        backgroundColor: '#0066cc',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isConcatenating ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        marginTop: '10px'
                    }}
                >
                    {isConcatenating ? 'Concatenating...' : 'Concatenate and Open'}
                </button>
            </div>
        </div>
    );
};
