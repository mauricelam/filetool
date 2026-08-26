import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import init, { parse_ext4, read_ext4_file } from './ext4-wasm/pkg';
import { parseErofs, readErofsFile } from './erofs-wasm';
import { ColumnView } from '../components/ColumnView';

const guessImageType = (data: Uint8Array): string | null => {
    const checkString = (offset: number, str: string) => {
        if (data.length < offset + str.length) return false;
        for (let i = 0; i < str.length; i++) {
            if (data[offset + i] !== str.charCodeAt(i)) return false;
        }
        return true;
    };

    if (checkString(0x3, "NTFS    ")) return "NTFS";
    if (checkString(0x3, "EXFAT   ")) return "exFAT";
    if (checkString(0x52, "FAT32   ")) return "FAT32";
    if (checkString(0x36, "FAT12   ")) return "FAT12";
    if (checkString(0x36, "FAT16   ")) return "FAT16";
    if (checkString(0x0, "XFSB")) return "XFS";
    if (checkString(0x20, "NXSB") || checkString(0x0, "NXSB") || checkString(0x8, "NXSB")) return "APFS";
    if (checkString(0x8001, "CD001")) return "ISO9660";
    if (checkString(0x10040, "_BHRfS_M")) return "Btrfs";
    if (data.length >= 0x404 && data[0x400] === 0xE2 && data[0x401] === 0xE1 && data[0x402] === 0xF5 && data[0x403] === 0xE0) return "EROFS";
    if (data.length > 0x400 + 4 && data[0x400] === 0x10 && data[0x401] === 0x20 && data[0x402] === 0xF5 && data[0x403] === 0xF2) return "F2FS";
    if (checkString(0x400, "H+") || checkString(0x400, "HX")) return "HFS+";
    if (checkString(0x0, "hsqs")) return "SquashFS";
    if (checkString(0x1FE, "\x55\xAA")) return "MBR/FAT";
    if (checkString(512, "EFI PART")) return "GPT";

    return null;
};

const ImageViewer: React.FC = () => {
    const [fileData, setFileData] = useState<Uint8Array | null>(null);
    const [tree, setTree] = useState<any>(null);
    const [imageType, setImageType] = useState<'ext4' | 'erofs' | null>(null);
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
                // erofs magic number 0xE0F5E1E2 (0xE2, 0xE1, 0xF5, 0xE0) at offset 1024 (0x400)
                const isErofs = data.length >= 0x404 && data[0x400] === 0xE2 && data[0x401] === 0xE1 && data[0x402] === 0xF5 && data[0x403] === 0xE0;

                if (isExt4) {
                    setImageType('ext4');
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
                } else if (isErofs) {
                    setImageType('erofs');
                    try {
                        setLoading(true);
                        const parsedTree = await parseErofs(data);
                        setTree(parsedTree);
                    } catch (err) {
                        setError(`Failed to parse erofs: ${err}`);
                        console.error(err);
                    } finally {
                        setLoading(false);
                    }
                } else {
                    const guessedType = guessImageType(data);
                    if (guessedType) {
                        setError(`.img file with type ${guessedType} is not supported yet. Try an ext4 or EROFS formatted img file instead`);
                    } else {
                        setError("This file does not appear to be a valid ext4 or EROFS filesystem image.");
                    }
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const extractFileContent = async (file: any): Promise<Uint8Array> => {
        if (!fileData) throw new Error("No image file loaded");
        if (imageType === 'erofs') {
            return await readErofsFile(fileData, file._path);
        } else {
            return read_ext4_file(fileData, file._path);
        }
    };

    const handleDownload = async (file: any, name: string) => {
        try {
            const content = await extractFileContent(file);
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
        try {
            const content = await extractFileContent(file);
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
                        setImageType(null);
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
        return <div style={{ padding: '20px' }}>Parsing {imageType || 'filesystem'} image...</div>;
    }

    if (!tree) {
        return <div style={{ padding: '20px' }}>Waiting for file...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '0 20px' }}>
                <h2>{imageType === 'erofs' ? 'EROFS Image Explorer' : 'ext4 Image Explorer'}</h2>
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
    createRoot(rootElement).render(<ImageViewer />);
}
