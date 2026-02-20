import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import init, { parse_ext4, read_ext4_file, Ext4File } from './ext4-wasm/pkg';
import { ColumnView } from '../components/ColumnView';

const Ext4Viewer: React.FC = () => {
    const [fileData, setFileData] = useState<Uint8Array | null>(null);
    const [tree, setTree] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        init().then(() => {
            if (window.parent) {
                window.parent.postMessage({ action: 'requestFile' });
            }
        }).catch(err => setError(`Failed to initialize WASM: ${err}`));

        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                const file = e.data.file as File;
                const buffer = await file.arrayBuffer();
                const data = new Uint8Array(buffer);
                setFileData(data);

                // ext4 magic number 0xEF53 at offset 1080 (0x438)
                const isExt4 = data.length > 1081 && data[1080] === 0x53 && data[1081] === 0xEF;
                if (!isExt4) {
                    setError("This file does not appear to be a valid ext4 filesystem image.");
                    return;
                }

                try {
                    setLoading(true);
                    const parsedTree = parse_ext4(data);
                    setTree(parsedTree);
                } catch (err) {
                    setError(`Failed to parse ext4: ${err}`);
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleDownload = async (file: any, name: string) => {
        if (!fileData) return;
        try {
            const content = read_ext4_file(fileData, file._path);
            const blob = new Blob([content]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert(`Failed to extract file: ${err}`);
        }
    };

    const handleOpen = async (file: any, name: string) => {
        if (!fileData) return;
        try {
            const content = read_ext4_file(fileData, file._path);
            const newFile = new File([content], name, { type: 'application/octet-stream' });
            window.parent?.postMessage({
                action: 'openFile',
                file: newFile
            }, "*");
        } catch (err) {
            alert(`Failed to open file: ${err}`);
        }
    };

    const renderFileActions = (item: any, path: string[]) => {
        // If it's a file, it will have _path (from Rust struct Ext4File)
        // tsify removes the underscores in the TS types but Rust serde [serde(rename = "_path")]
        // means the JSON object WILL have the underscores.
        if (item._path) {
            const name = path[path.length - 1];
            return (
                <div className="file-actions">
                    <button onClick={() => handleOpen(item, name)} title="Open">
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                            <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z" />
                        </svg>
                    </button>
                    <button onClick={() => handleDownload(item, name)} title="Download">
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                            <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z" />
                        </svg>
                    </button>
                </div>
            );
        }
        return null;
    };

    const renderFilePreview = (item: any, path: string[]) => {
        if (!item._path) return null;

        return (
            <div style={{ padding: '20px' }}>
                <h3>File Details</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '4px', borderBottom: '1px solid #eee' }}>Path</td>
                            <td style={{ padding: '4px', borderBottom: '1px solid #eee' }}>{item._path}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '4px', borderBottom: '1px solid #eee' }}>Size</td>
                            <td style={{ padding: '4px', borderBottom: '1px solid #eee' }}>{item._size.toLocaleString()} bytes</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '4px', borderBottom: '1px solid #eee' }}>Mode</td>
                            <td style={{ padding: '4px', borderBottom: '1px solid #eee' }}>0o{item._mode.toString(8)}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '4px', borderBottom: '1px solid #eee' }}>UID/GID</td>
                            <td style={{ padding: '4px', borderBottom: '1px solid #eee' }}>{item._uid} / {item._gid}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    if (error) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '20px',
                textAlign: 'center',
                color: '#333'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ margin: '0 0 12px 0', color: '#d32f2f' }}>Error Loading Image</h2>
                <div style={{
                    backgroundColor: '#fdecea',
                    color: '#d32f2f',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    maxWidth: '450px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    border: '1px solid #f5c6cb'
                }}>
                    {error}
                </div>
                <button
                    onClick={() => {
                        setError(null);
                        setTree(null);
                        setFileData(null);
                        window.parent.postMessage({ action: 'requestFile' });
                    }}
                    style={{
                        marginTop: '20px',
                        padding: '8px 16px',
                        backgroundColor: '#f5f5f5',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Try again
                </button>
            </div>
        );
    }

    if (loading) {
        return <div style={{ padding: '20px' }}>Parsing ext4 image...</div>;
    }

    if (!tree) {
        return <div style={{ padding: '20px' }}>Waiting for file...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '0 20px' }}>
                <h2>ext4 Image Explorer</h2>
            </div>
            <ColumnView
                initialContent={tree}
                renderFileActions={renderFileActions}
                renderFilePreview={renderFilePreview}
            />
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    createRoot(rootElement).render(<Ext4Viewer />);
}
