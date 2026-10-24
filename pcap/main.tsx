import React, { useEffect, useState, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Wiregasm, vectorToArray } from '@goodtools/wiregasm';
import loadWiregasm from '@goodtools/wiregasm/dist/wiregasm.js';

interface SummaryData {
    filename: string;
    file_type: string;
    file_length: number;
    file_encap_type: string;
    packet_count: number;
    start_time: number;
    stop_time: number;
    elapsed_time: number;
}

interface FrameRow {
    number: number;
    comments: boolean;
    ignored: boolean;
    marked: boolean;
    bg?: number;
    fg?: number;
    columns: string[];
}

interface TreeNode {
    label: string;
    filter: string;
    start: number;
    length: number;
    children: TreeNode[];
}

interface DataSource {
    name: string;
    data: Uint8Array;
}

interface FrameDetail {
    number: number;
    comments: string;
    dataSources: DataSource[];
    tree: TreeNode[];
}

async function fetchAndDecompress(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    }
    if (!res.body) {
        throw new Error(`Empty response body for ${url}`);
    }
    const ds = new DecompressionStream('gzip');
    const decompressedStream = res.body.pipeThrough(ds);
    const decompressedResponse = new Response(decompressedStream);
    return await decompressedResponse.arrayBuffer();
}

function parseWiregasmTree(vecOrArray: any): TreeNode[] {
    let rawNodes: any[];
    try {
        rawNodes = vectorToArray(vecOrArray);
    } catch {
        if (Array.isArray(vecOrArray)) {
            rawNodes = vecOrArray;
        } else {
            return [];
        }
    }

    return rawNodes.map((node: any) => ({
        label: node.label || '',
        filter: node.filter || '',
        start: typeof node.start === 'number' ? node.start : 0,
        length: typeof node.length === 'number' ? node.length : 0,
        children: node.tree ? parseWiregasmTree(node.tree) : []
    }));
}

function parseWiregasmDataSources(vecOrArray: any): DataSource[] {
    let rawDs: any[];
    try {
        rawDs = vectorToArray(vecOrArray);
    } catch {
        if (Array.isArray(vecOrArray)) {
            rawDs = vecOrArray;
        } else {
            return [];
        }
    }

    return rawDs.map((ds: any) => {
        let bytes: Uint8Array;
        try {
            const arr = vectorToArray(ds.data);
            bytes = new Uint8Array(arr);
        } catch {
            bytes = ds.data instanceof Uint8Array ? ds.data : new Uint8Array(ds.data || []);
        }
        return {
            name: ds.name || 'Frame',
            data: bytes
        };
    });
}

const ProtocolTreeNode: React.FC<{
    node: TreeNode;
    level: number;
    onSelectRange: (start: number, length: number) => void;
    activeRange: { start: number; length: number } | null;
}> = ({ node, level, onSelectRange, activeRange }) => {
    const [expanded, setExpanded] = useState<boolean>(level < 1);
    const hasChildren = node.children.length > 0;

    const isHighlighted =
        activeRange !== null &&
        node.length > 0 &&
        node.start === activeRange.start &&
        node.length === activeRange.length;

    return (
        <div style={{ marginLeft: `${level * 16}px`, fontFamily: 'monospace', fontSize: '12px' }}>
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    if (hasChildren) {
                        setExpanded(!expanded);
                    }
                    if (node.length > 0) {
                        onSelectRange(node.start, node.length);
                    }
                }}
                onMouseEnter={(e) => {
                    e.stopPropagation();
                    if (node.length > 0) {
                        onSelectRange(node.start, node.length);
                    }
                }}
                style={{
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    backgroundColor: isHighlighted ? '#cce5ff' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    userSelect: 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                }}
            >
                {hasChildren ? (
                    <span style={{ marginRight: '6px', fontWeight: 'bold', fontSize: '10px', width: '10px' }}>
                        {expanded ? '▼' : '▶'}
                    </span>
                ) : (
                    <span style={{ marginRight: '6px', width: '10px' }}>▪</span>
                )}
                <span>{node.label}</span>
            </div>
            {hasChildren && expanded && (
                <div>
                    {node.children.map((child, idx) => (
                        <ProtocolTreeNode
                            key={idx}
                            node={child}
                            level={level + 1}
                            onSelectRange={onSelectRange}
                            activeRange={activeRange}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const HexView: React.FC<{
    data: Uint8Array;
    activeRange: { start: number; length: number } | null;
}> = ({ data, activeRange }) => {
    const rows = useMemo(() => {
        const result: { offset: number; hex: string[]; ascii: string }[] = [];
        for (let i = 0; i < data.length; i += 16) {
            const chunk = data.slice(i, i + 16);
            const hex: string[] = [];
            let ascii = '';
            for (let j = 0; j < chunk.length; j++) {
                const byte = chunk[j];
                hex.push(byte.toString(16).padStart(2, '0'));
                ascii += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
            }
            result.push({ offset: i, hex, ascii });
        }
        return result;
    }, [data]);

    const isByteHighlighted = (byteOffset: number) => {
        if (!activeRange) return false;
        return (
            byteOffset >= activeRange.start &&
            byteOffset < activeRange.start + activeRange.length
        );
    };

    return (
        <div
            style={{
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '12px',
                padding: '8px',
                backgroundColor: '#ffffff',
                height: '100%',
                overflowY: 'auto',
                lineHeight: '1.4'
            }}
        >
            {rows.map((row) => (
                <div key={row.offset} style={{ display: 'flex', whiteSpace: 'pre' }}>
                    <span style={{ color: '#888', marginRight: '16px', userSelect: 'none' }}>
                        {row.offset.toString(16).padStart(4, '0')}
                    </span>
                    <div style={{ display: 'flex', marginRight: '24px' }}>
                        {Array.from({ length: 16 }).map((_, colIdx) => {
                            const byteOffset = row.offset + colIdx;
                            const hasByte = colIdx < row.hex.length;
                            const highlighted = hasByte && isByteHighlighted(byteOffset);

                            return (
                                <span
                                    key={colIdx}
                                    style={{
                                        marginRight: colIdx === 7 ? '12px' : '6px',
                                        backgroundColor: highlighted ? '#ffe87c' : 'transparent',
                                        color: hasByte ? (highlighted ? '#000' : '#333') : 'transparent',
                                        fontWeight: highlighted ? 'bold' : 'normal',
                                        padding: '0 1px',
                                        borderRadius: '2px'
                                    }}
                                >
                                    {hasByte ? row.hex[colIdx] : '  '}
                                </span>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex' }}>
                        {Array.from({ length: 16 }).map((_, colIdx) => {
                            const byteOffset = row.offset + colIdx;
                            const hasByte = colIdx < row.ascii.length;
                            const highlighted = hasByte && isByteHighlighted(byteOffset);

                            return (
                                <span
                                    key={colIdx}
                                    style={{
                                        backgroundColor: highlighted ? '#ffe87c' : 'transparent',
                                        color: hasByte ? (highlighted ? '#000' : '#555') : 'transparent',
                                        fontWeight: highlighted ? 'bold' : 'normal',
                                        borderRadius: '2px'
                                    }}
                                >
                                    {hasByte ? row.ascii[colIdx] : ' '}
                                </span>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

const App: React.FC = () => {
    const wgRef = useRef<Wiregasm | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [columns, setColumns] = useState<string[]>([]);
    const [frames, setFrames] = useState<FrameRow[]>([]);
    const [matchedCount, setMatchedCount] = useState<number>(0);
    const [filterText, setFilterText] = useState<string>('');
    const [activeFilter, setActiveFilter] = useState<string>('');
    const [filterError, setFilterError] = useState<string | null>(null);
    const [selectedFrameNum, setSelectedFrameNum] = useState<number | null>(null);
    const [frameDetail, setFrameDetail] = useState<FrameDetail | null>(null);
    const [activeByteRange, setActiveByteRange] = useState<{ start: number; length: number } | null>(null);
    const [activeTab, setActiveTab] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isCancelled = false;

        const initWiregasm = async () => {
            try {
                // Fetch and inflate compressed WebAssembly and data packages to stay under 25MB file size limit
                const [wasmBuffer, dataBuffer] = await Promise.all([
                    fetchAndDecompress('./wiregasm.wasm.gz'),
                    fetchAndDecompress('./wiregasm.data.gz')
                ]);

                const wg = new Wiregasm();
                await wg.init(loadWiregasm, {
                    wasmBinary: wasmBuffer,
                    getPreloadedPackage: (_name: string, _size: number) => dataBuffer,
                    locateFile: (path: string) => `./${path}`
                });

                if (!isCancelled) {
                    wgRef.current = wg;
                    setLoading(false);
                } else {
                    wg.destroy();
                }
            } catch (err: any) {
                console.error('Wiregasm init error:', err);
                if (!isCancelled) {
                    setError(`Failed to initialize Wireshark WASM engine: ${err?.message || err}`);
                    setLoading(false);
                }
            }
        };

        initWiregasm();

        return () => {
            isCancelled = true;
            if (wgRef.current) {
                wgRef.current.destroy();
                wgRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data?.action === 'respondFile') {
                const file: File = e.data.file;
                if (!file) return;

                setFileName(file.name);
                setLoading(true);
                setError(null);
                setSelectedFrameNum(null);
                setFrameDetail(null);
                setActiveByteRange(null);

                try {
                    while (!wgRef.current && !error) {
                        await new Promise((res) => setTimeout(res, 50));
                    }

                    const wg = wgRef.current;
                    if (!wg) {
                        throw new Error('Wiregasm engine not available');
                    }

                    const buffer = await file.arrayBuffer();
                    const bytes = new Uint8Array(buffer);

                    const loadRes = wg.load(file.name, bytes);
                    if (loadRes.code !== 0) {
                        throw new Error(loadRes.error || `Error code ${loadRes.code}`);
                    }

                    const cols = wg.columns();
                    setColumns(cols);
                    setSummary(loadRes.summary as SummaryData);

                    loadFrames(wg, '', 0, 1000);
                    setLoading(false);
                } catch (err: any) {
                    console.error('Failed to parse PCAP:', err);
                    setError(`Failed to parse PCAP file: ${err?.message || err}`);
                    setLoading(false);
                }
            }
        };

        window.addEventListener('message', handleMessage);

        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' }, '*');
        }

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const loadFrames = (wg: Wiregasm, filter: string, skip = 0, limit = 1000) => {
        try {
            const res = wg.frames(filter, skip, limit);
            const rawFrames = vectorToArray(res.frames);

            const parsedRows: FrameRow[] = rawFrames.map((f: any) => {
                const colVals = vectorToArray(f.columns);
                return {
                    number: f.number,
                    comments: f.comments,
                    ignored: f.ignored,
                    marked: f.marked,
                    bg: f.bg,
                    fg: f.fg,
                    columns: colVals
                };
            });

            setFrames(parsedRows);
            setMatchedCount(res.matched);

            if (parsedRows.length > 0 && selectedFrameNum === null) {
                selectFrame(wg, parsedRows[0].number);
            }
        } catch (err: any) {
            console.error('Error fetching frames:', err);
            setError(`Error fetching packet frames: ${err?.message || err}`);
        }
    };

    const selectFrame = (wg: Wiregasm, frameNum: number) => {
        try {
            setSelectedFrameNum(frameNum);
            setActiveByteRange(null);
            const detail = wg.frame(frameNum);

            const parsedTree = parseWiregasmTree(detail.tree);
            const parsedDs = parseWiregasmDataSources(detail.data_sources);

            setFrameDetail({
                number: detail.number,
                comments: detail.comments || '',
                dataSources: parsedDs,
                tree: parsedTree
            });
            setActiveTab(0);
        } catch (err: any) {
            console.error(`Error loading frame ${frameNum}:`, err);
        }
    };

    const handleFilterChange = (val: string) => {
        setFilterText(val);
        const wg = wgRef.current;
        if (!wg) return;

        if (val.trim() === '') {
            setFilterError(null);
            return;
        }

        const testRes = wg.testFilter(val.trim());
        if (!testRes.ok) {
            setFilterError(testRes.error || 'Invalid filter syntax');
        } else {
            setFilterError(null);
        }
    };

    const applyFilter = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const wg = wgRef.current;
        if (!wg) return;

        const filter = filterText.trim();
        setActiveFilter(filter);
        loadFrames(wg, filter, 0, 1000);
    };

    const clearFilter = () => {
        setFilterText('');
        setActiveFilter('');
        setFilterError(null);
        const wg = wgRef.current;
        if (wg) {
            loadFrames(wg, '', 0, 1000);
        }
    };

    const getRowStyle = (row: FrameRow, isSelected: boolean): React.CSSProperties => {
        if (isSelected) {
            return {
                backgroundColor: '#0056b3',
                color: '#ffffff'
            };
        }

        const style: React.CSSProperties = {};

        // In Wiregasm (sharkd), bg <= 1 or fg <= 0 indicates no color filter rule matched
        if (typeof row.bg === 'number' && row.bg > 1) {
            style.backgroundColor = '#' + row.bg.toString(16).padStart(6, '0');
        }

        if (typeof row.fg === 'number' && row.fg > 0) {
            style.color = '#' + row.fg.toString(16).padStart(6, '0');
        }

        return style;
    };

    if (loading) {
        return (
            <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
                <h3>Loading PCAP capture...</h3>
                <p>Initializing Wireshark WebAssembly engine and dissecting packets.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '24px', color: '#dc3545' }}>
                <h3>Error Loading File</h3>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
            <div
                style={{
                    padding: '8px 12px',
                    backgroundColor: '#e9ecef',
                    borderBottom: '1px solid #dee2e6',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#343a40' }}>
                        {fileName || summary?.filename || 'Capture File'}
                    </div>
                    {summary && (
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>
                            Packets: {matchedCount} / {summary.packet_count} | Size: {(summary.file_length / 1024).toFixed(1)} KB | Format: {summary.file_type}
                        </div>
                    )}
                </div>

                <form onSubmit={applyFilter} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#495057' }}>Display Filter:</label>
                    <input
                        type="text"
                        value={filterText}
                        onChange={(e) => handleFilterChange(e.target.value)}
                        placeholder='e.g., tcp, dns, ip.addr == 192.168.1.1'
                        style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            borderRadius: '4px',
                            border: `1px solid ${filterError ? '#dc3545' : filterText ? '#28a745' : '#ced4da'}`,
                            backgroundColor: filterError ? '#f8d7da' : filterText && !filterError ? '#e8f8f0' : '#ffffff',
                            outline: 'none'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!!filterError}
                        style={{
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 500,
                            backgroundColor: filterError ? '#6c757d' : '#0066cc',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: filterError ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Apply
                    </button>
                    {activeFilter && (
                        <button
                            type="button"
                            onClick={clearFilter}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                backgroundColor: '#6c757d',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Clear
                        </button>
                    )}
                </form>
                {filterError && (
                    <div style={{ color: '#dc3545', fontSize: '11px', fontFamily: 'monospace' }}>
                        Filter error: {filterError}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: '1 1 45%', overflow: 'auto', borderBottom: '2px solid #ccc' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'sans-serif' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '1px solid #dee2e6', stickyTop: 0, position: 'sticky', top: 0, zIndex: 1 }}>
                                {columns.map((col, idx) => (
                                    <th
                                        key={idx}
                                        style={{
                                            textAlign: idx === 0 || idx === 5 ? 'right' : 'left',
                                            padding: '6px 8px',
                                            fontWeight: 600,
                                            borderRight: '1px solid #dee2e6',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {frames.map((row) => {
                                const isSelected = selectedFrameNum === row.number;
                                return (
                                    <tr
                                        key={row.number}
                                        onClick={() => wgRef.current && selectFrame(wgRef.current, row.number)}
                                        style={{
                                            ...getRowStyle(row, isSelected),
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #e9ecef',
                                            userSelect: 'none'
                                        }}
                                    >
                                        {row.columns.map((val, idx) => (
                                            <td
                                                key={idx}
                                                style={{
                                                    padding: '4px 8px',
                                                    textAlign: idx === 0 || idx === 5 ? 'right' : 'left',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    maxWidth: idx === 6 ? '400px' : 'auto',
                                                    fontFamily: idx === 1 || idx === 2 || idx === 3 ? 'monospace' : 'inherit'
                                                }}
                                            >
                                                {val}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div style={{ flex: '1 1 55%', display: 'flex', overflow: 'hidden' }}>
                    <div
                        style={{
                            flex: '1 1 50%',
                            borderRight: '2px solid #ccc',
                            overflow: 'auto',
                            padding: '8px',
                            backgroundColor: '#fafafa'
                        }}
                    >
                        <div style={{ fontWeight: 600, marginBottom: '8px', color: '#495057', fontSize: '13px' }}>
                            Frame Details {frameDetail ? `#${frameDetail.number}` : ''}
                        </div>
                        {frameDetail ? (
                            <div>
                                {frameDetail.tree.map((node, idx) => (
                                    <ProtocolTreeNode
                                        key={idx}
                                        node={node}
                                        level={0}
                                        onSelectRange={(start, length) => setActiveByteRange({ start, length })}
                                        activeRange={activeByteRange}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div style={{ color: '#888', fontStyle: 'italic' }}>Select a packet to view protocol details</div>
                        )}
                    </div>

                    <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {frameDetail && frameDetail.dataSources.length > 0 && (
                            <div style={{ display: 'flex', backgroundColor: '#e9ecef', borderBottom: '1px solid #dee2e6' }}>
                                {frameDetail.dataSources.map((ds, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveTab(idx)}
                                        style={{
                                            padding: '6px 12px',
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            border: 'none',
                                            borderBottom: activeTab === idx ? '2px solid #0066cc' : '2px solid transparent',
                                            backgroundColor: activeTab === idx ? '#ffffff' : 'transparent',
                                            color: activeTab === idx ? '#0066cc' : '#495057',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {ds.name} ({ds.data.length} bytes)
                                    </button>
                                ))}
                            </div>
                        )}

                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            {frameDetail && frameDetail.dataSources.length > activeTab ? (
                                <HexView
                                    data={frameDetail.dataSources[activeTab].data}
                                    activeRange={activeByteRange}
                                />
                            ) : (
                                <div style={{ padding: '16px', color: '#888', fontStyle: 'italic' }}>
                                    No byte payload available
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container!);
root.render(<App />);
