import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ColumnView } from '../components/ColumnView';

export interface PartitionInfo {
    index: number;
    scheme: string;
    start_lba: number;
    size_lba: number;
    start_bytes: number;
    size_bytes: number;
    kind: string;
    name?: string;
    fs_kind?: string;
}

export interface DirEntryInfo {
    name: string;
    is_dir: boolean;
    size: number;
    inode: number;
    kind: string;
}

export interface DiskInfo {
    container_format: string;
    total_size: number;
    partitions: PartitionInfo[];
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const DiskViewer: React.FC = () => {
    const [diskInfo, setDiskInfo] = useState<DiskInfo | null>(null);
    const [selectedPartitionIndex, setSelectedPartitionIndex] = useState<number>(0);
    const [tree, setTree] = useState<{ [key: string]: any }>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('Waiting for file...');

    const workerRef = useRef<Worker | null>(null);
    const pendingRpcRef = useRef<Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>>(new Map());
    const nextRpcIdRef = useRef<number>(1);
    const loadedPathsRef = useRef<Set<string>>(new Set());

    const rpcCall = useCallback((type: string, payload: any = {}): Promise<any> => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) {
                return reject(new Error('Worker not available'));
            }
            const id = nextRpcIdRef.current++;
            pendingRpcRef.current.set(id, { resolve, reject });
            workerRef.current.postMessage({ id, type, ...payload });
        });
    }, []);

    const fetchDirectory = useCallback(async (partIdx: number, isPartitioned: boolean, pathStr: string) => {
        const cacheKey = `${partIdx}:${pathStr}`;
        if (loadedPathsRef.current.has(cacheKey)) {
            return;
        }

        try {
            const entries: DirEntryInfo[] = await rpcCall('list_dir', {
                partitionIndex: partIdx,
                isPartitioned,
                path: pathStr
            });

            loadedPathsRef.current.add(cacheKey);

            setTree(prevTree => {
                const newTree = { ...prevTree };
                const segments = pathStr.split('/').filter(s => s.length > 0);

                let current = newTree;
                for (const seg of segments) {
                    if (!current[seg] || typeof current[seg] !== 'object') {
                        current[seg] = {};
                    }
                    current = current[seg];
                }

                for (const entry of entries) {
                    const entryPath = pathStr === '/' ? `/${entry.name}` : `${pathStr}/${entry.name}`;
                    if (entry.is_dir) {
                        if (!current[entry.name]) {
                            current[entry.name] = {
                                _path: entryPath,
                                _size: entry.size,
                                _inode: entry.inode,
                                _kind: entry.kind,
                                _isDir: true
                            };
                        }
                    } else {
                        current[entry.name] = {
                            _path: entryPath,
                            _size: entry.size,
                            _inode: entry.inode,
                            _kind: entry.kind,
                            _isDir: false
                        };
                    }
                }
                return newTree;
            });
        } catch (err: any) {
            console.error(`Failed to list dir '${pathStr}':`, err);
            setError(err?.message || String(err));
        }
    }, [rpcCall]);

    useEffect(() => {
        const worker = new Worker('worker.js', { type: 'module' });
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent) => {
            const { id, type, error: errMsg, diskInfo: info, entries, bytes } = e.data;

            if (type === 'init_ok') {
                setDiskInfo(info);
                setLoading(false);
                setStatusMessage('');
                return;
            }

            if (type === 'init_error') {
                setError(errMsg || 'Failed to initialize disk image parser');
                setLoading(false);
                return;
            }

            if (id !== undefined && pendingRpcRef.current.has(id)) {
                const { resolve, reject } = pendingRpcRef.current.get(id)!;
                pendingRpcRef.current.delete(id);

                if (type === 'error') {
                    reject(new Error(errMsg));
                } else if (type === 'list_dir_ok') {
                    resolve(entries);
                } else if (type === 'read_file_range_ok') {
                    resolve(bytes);
                } else {
                    resolve(e.data);
                }
            }
        };

        worker.onerror = (e) => {
            console.error('Worker error:', e);
            setError(`Worker error: ${e.message}`);
            setLoading(false);
        };

        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' }, '*');
        }

        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                const file = e.data.file as File;
                setLoading(true);
                setStatusMessage(`Opening ${file.name}...`);
                setError(null);
                setDiskInfo(null);
                setTree({});
                loadedPathsRef.current.clear();

                worker.postMessage({ type: 'init', file });
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
            worker.terminate();
        };
    }, []);

    useEffect(() => {
        if (!diskInfo) return;

        const isPartitioned = diskInfo.partitions.length > 0 && diskInfo.partitions[0].scheme !== 'None';
        const activePart = diskInfo.partitions[selectedPartitionIndex] || diskInfo.partitions[0];

        if (activePart) {
            setError(null);
            setTree({});
            loadedPathsRef.current.clear();
            fetchDirectory(activePart.index, isPartitioned, '/');
        }
    }, [diskInfo, selectedPartitionIndex, fetchDirectory]);

    const handleItemClick = (level: number, key: string, content: any) => {
        if (!content || typeof content !== 'object') return;
        if (content._isDir && content._path) {
            const isPartitioned = diskInfo?.partitions[0]?.scheme !== 'None';
            fetchDirectory(selectedPartitionIndex, isPartitioned, content._path);
        }
    };

    const extractFileBuffer = async (filePath: string, fileSize: number): Promise<Uint8Array> => {
        const isPartitioned = diskInfo?.partitions[0]?.scheme !== 'None';
        const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
        const result = new Uint8Array(fileSize);

        let offset = 0;
        while (offset < fileSize) {
            const length = Math.min(CHUNK_SIZE, fileSize - offset);
            const chunk: Uint8Array = await rpcCall('read_file_range', {
                partitionIndex: selectedPartitionIndex,
                isPartitioned,
                path: filePath,
                offset,
                length
            });
            if (chunk.length === 0) break;
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    };

    const handleDownload = async (item: any, name: string) => {
        if (!item._path) return;
        try {
            setStatusMessage(`Extracting ${name}...`);
            const buffer = await extractFileBuffer(item._path, item._size);
            const blob = new Blob([buffer]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
            setStatusMessage('');
        } catch (err: any) {
            alert(`Failed to extract file: ${err.message || err}`);
            setStatusMessage('');
        }
    };

    const handleOpen = async (item: any, name: string) => {
        if (!item._path) return;
        try {
            setStatusMessage(`Opening ${name}...`);
            const buffer = await extractFileBuffer(item._path, item._size);
            const file = new File([buffer], name, { type: 'application/octet-stream' });
            window.parent?.postMessage({
                action: 'openFile',
                file
            }, '*');
            setStatusMessage('');
        } catch (err: any) {
            alert(`Failed to open file: ${err.message || err}`);
            setStatusMessage('');
        }
    };

    const renderFileActions = (item: any, path: string[]) => {
        if (item && typeof item === 'object' && item._path && !item._isDir) {
            const name = path[path.length - 1];
            return (
                <div className="file-actions" style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => handleOpen(item, name)} title="Open in viewer" style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: '2px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                            <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z" />
                        </svg>
                    </button>
                    <button onClick={() => handleDownload(item, name)} title="Download file" style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: '2px' }}>
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
        if (!item || typeof item !== 'object' || !item._path) return null;

        return (
            <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Item Details</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <tbody>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '6px 8px', borderBottom: '1px solid #eee', width: '120px' }}>Type</td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>{item._isDir ? 'Directory' : 'File'} ({item._kind || 'generic'})</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Path</td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', wordBreak: 'break-all' }}>{item._path}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Size</td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>{formatBytes(item._size)} ({item._size.toLocaleString()} bytes)</td>
                        </tr>
                        {item._inode !== undefined && (
                            <tr>
                                <td style={{ fontWeight: 'bold', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Inode</td>
                                <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>{item._inode}</td>
                            </tr>
                        )}
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
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ margin: '0 0 12px 0', color: '#d32f2f' }}>Disk Image Error</h2>
                <div style={{
                    backgroundColor: '#fdecea',
                    color: '#d32f2f',
                    padding: '16px 24px',
                    borderRadius: '8px',
                    maxWidth: '500px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    border: '1px solid #f5c6cb'
                }}>
                    {error}
                </div>
            </div>
        );
    }

    if (loading || !diskInfo) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '20px',
                color: '#666'
            }}>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>{statusMessage || 'Loading disk image...'}</div>
            </div>
        );
    }

    const currentPartition = diskInfo.partitions[selectedPartitionIndex] || diskInfo.partitions[0];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                backgroundColor: '#f5f5f5',
                borderBottom: '1px solid #e0e0e0',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                        Disk Image Explorer ({diskInfo.container_format.toUpperCase()})
                    </h2>
                    <span style={{ fontSize: '13px', color: '#666' }}>
                        Total Size: {formatBytes(diskInfo.total_size)}
                    </span>
                </div>

                {diskInfo.partitions.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: '#444' }}>
                            Partition ({currentPartition.scheme}):
                        </label>
                        <select
                            value={selectedPartitionIndex}
                            onChange={(e) => setSelectedPartitionIndex(Number(e.target.value))}
                            style={{
                                padding: '6px 10px',
                                borderRadius: '4px',
                                border: '1px solid #ccc',
                                fontSize: '13px',
                                backgroundColor: '#ffffff',
                                cursor: 'pointer'
                            }}
                        >
                            {diskInfo.partitions.map((p) => (
                                <option key={p.index} value={p.index}>
                                    #{p.index + 1} {p.name ? `"${p.name}" ` : ''}({p.kind}) - {formatBytes(p.size_bytes)} {p.fs_kind ? `[${p.fs_kind}]` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <ColumnView
                    initialContent={tree}
                    onItemClick={handleItemClick}
                    renderFileActions={renderFileActions}
                    renderFilePreview={renderFilePreview}
                />
            </div>
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    createRoot(rootElement).render(<DiskViewer />);
}
