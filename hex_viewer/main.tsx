import { createRoot } from 'react-dom/client'
import { offset, renderAscii, renderHex } from './hex'
import React, { ReactNode, useCallback, useEffect, useState } from 'react'
import * as utils from './data-utils'

export interface Marker {
    start: number;
    length: number;
    format: string;
    type?: 'data' | 'length';
    headerLength?: number;
}

if (window.parent && window.parent !== window) {
    window.parent.postMessage({ 'action': 'requestFile' }, '*')
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

const outputElement = document.getElementById('output');
const OUTPUT = outputElement ? createRoot(outputElement) : null

async function handleFile(file: File) {
    const buf = new Uint8Array(await file.arrayBuffer())
    OUTPUT?.render(<HexViewer buffer={buf} />)
}

function SelectionInfo({ selection, buffer, onSetSelection, onJumpToOffset }: { selection: [number, number] | null, buffer: Uint8Array, onSetSelection: (start: number, end: number) => void, onJumpToOffset: (offset: number) => void }) {
    const start = selection ? selection[0] : 0;
    const end = selection ? selection[1] : 0;
    const length = selection ? end - start + 1 : 0;

    const [isExpanded, setIsExpanded] = useState(false);

    const onOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const offset = parseInt(e.target.value, 10);
        if (!isNaN(offset)) {
            onSetSelection(offset, offset + Math.max(0, length - 1));
        }
    };

    const onLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const len = parseInt(e.target.value, 10);
        if (!isNaN(len)) {
            onSetSelection(start, start + Math.max(0, len - 1));
        }
    };

    const renderSelectedData = () => {
        if (!selection) return "No selection";
        const data = buffer.slice(start, end + 1);

        if (!isExpanded) {
            const hex = Array.from(data.slice(0, 1024)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
            return (
                <div className="data-preview single-line" onClick={() => setIsExpanded(true)}>
                    {hex}
                </div>
            );
        } else {
            const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
            return (
                <div className="data-preview expanded" onClick={() => setIsExpanded(false)}>
                    {hex}
                </div>
            );
        }
    };

    return (
        <div className="selection-info">
            <div className="selection-info-row">
                <span className="inspector-label">Offset</span>
                <input type="number" value={start} onChange={onOffsetChange} min={0} max={buffer.length - 1} />
            </div>
            <div className="selection-info-row">
                <span className="inspector-label">Hex Range</span>
                <span className="inspector-value">
                    <span className="clickable-offset" onClick={() => onJumpToOffset(start)}>0x{start.toString(16).toUpperCase()}</span>
                    {' - '}
                    <span className="clickable-offset" onClick={() => onJumpToOffset(end)}>0x{end.toString(16).toUpperCase()}</span>
                </span>
            </div>
            <div className="selection-info-row">
                <span className="inspector-label">Length</span>
                <input type="number" value={length} onChange={onLengthChange} min={0} max={buffer.length} />
            </div>
            <div className="selection-info-row data-row">
                <span className="inspector-label">Data</span>
                <div className="inspector-value data-container">{renderSelectedData()}</div>
            </div>
        </div>
    );
}

export function DataInspector({ buffer, index, selection, markers, onAddMarker, onRemoveMarker, setPreviewMarker, onJumpToOffset, searchResults, currentMatchIndex, matchLength, onSearch, onSetSelection }: { buffer: Uint8Array, index: number | null, selection: [number, number] | null, markers: Marker[], onAddMarker: (format: string, length: number, type?: 'data' | 'length', headerLength?: number) => void, onRemoveMarker: (index: number) => void, setPreviewMarker: (marker: Marker | null) => void, onJumpToOffset: (offset: number) => void, searchResults: number[], currentMatchIndex: number | null, matchLength: number, onSearch: (results: number[], index: number | null, matchLength: number) => void, onSetSelection: (start: number, end: number) => void }) {
    const [activeTab, setActiveTab] = useState<'inspector' | 'search' | 'analysis' | 'hashing' | 'markers'>('inspector');

    return (
        <div id="inspector" style={{ width: '100%' }}>
            <SelectionInfo selection={selection} buffer={buffer} onSetSelection={onSetSelection} onJumpToOffset={onJumpToOffset} />
            <div className="tab-header">
                <button className={`tab-button ${activeTab === 'inspector' ? 'active' : ''}`} onClick={() => setActiveTab('inspector')}>Inspector</button>
                <button className={`tab-button ${activeTab === 'markers' ? 'active' : ''}`} onClick={() => setActiveTab('markers')}>Markers</button>
                <button className={`tab-button ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>Search</button>
                <button className={`tab-button ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>Analysis</button>
                <button className={`tab-button ${activeTab === 'hashing' ? 'active' : ''}`} onClick={() => setActiveTab('hashing')}>Hashing</button>
            </div>
            <div className="tab-content">
                {activeTab === 'inspector' && (
                    <InspectorTab
                        buffer={buffer}
                        index={index}
                        selection={selection}
                        markers={markers}
                        onAddMarker={onAddMarker}
                        onRemoveMarker={onRemoveMarker}
                        setPreviewMarker={setPreviewMarker}
                    />
                )}
                {activeTab === 'search' && <SearchTab buffer={buffer} results={searchResults} currentIndex={currentMatchIndex} matchLength={matchLength} onSearch={onSearch} onJumpToOffset={onJumpToOffset} />}
                {activeTab === 'markers' && <MarkersTab markers={markers} onRemoveMarker={onRemoveMarker} onJumpToOffset={onJumpToOffset} />}
                {activeTab === 'analysis' && <AnalysisTab buffer={buffer} onJumpToOffset={onJumpToOffset} />}
                {activeTab === 'hashing' && <HashingTab buffer={buffer} selection={selection} />}
            </div>
        </div>
    );
}

function MarkersTab({ markers, onRemoveMarker, onJumpToOffset }: { markers: Marker[], onRemoveMarker: (index: number) => void, onJumpToOffset: (offset: number) => void }) {
    return (
        <>
            <ul className="marker-list">
                {markers.map((m, i) => (
                    <li key={i} className="marker-item">
                        <span className="clickable-offset" onClick={() => onJumpToOffset(m.start)}>0x{m.start.toString(16).toUpperCase()}: {m.format} ({m.length})</span>
                        <button className="icon-button" onClick={() => onRemoveMarker(i)}>X</button>
                    </li>
                ))}
            </ul>
        </>
    );
}

export function SearchTab({ buffer, results, currentIndex, matchLength, onSearch, onJumpToOffset }: { buffer: Uint8Array, results: number[], currentIndex: number | null, matchLength: number, onSearch: (results: number[], index: number | null, matchLength: number) => void, onJumpToOffset: (offset: number) => void }) {
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState<'hex' | 'utf8' | 'utf16' | 'regex'>('hex');

    const performSearch = () => {
        if (!query) {
            onSearch([], null, 0);
            return;
        }

        const matches: number[] = [];
        let matchLen = 0;
        try {
            if (searchType === 'hex') {
                const hexQuery = query.replace(/\s+/g, '');
                if (hexQuery.length % 2 !== 0) return;
                const pattern = new Uint8Array(hexQuery.length / 2);
                for (let i = 0; i < hexQuery.length; i += 2) {
                    pattern[i / 2] = parseInt(hexQuery.substr(i, 2), 16);
                }
                matchLen = pattern.length;
                for (let i = 0; i <= buffer.length - pattern.length; i++) {
                    let match = true;
                    for (let j = 0; j < pattern.length; j++) {
                        if (buffer[i + j] !== pattern[j]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) matches.push(i);
                }
            } else if (searchType === 'utf8') {
                const pattern = new TextEncoder().encode(query);
                matchLen = pattern.length;
                for (let i = 0; i <= buffer.length - pattern.length; i++) {
                    let match = true;
                    for (let j = 0; j < pattern.length; j++) {
                        if (buffer[i + j] !== pattern[j]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) matches.push(i);
                }
            } else if (searchType === 'utf16') {
                const pattern = new Uint8Array(query.length * 2);
                for (let i = 0; i < query.length; i++) {
                    const code = query.charCodeAt(i);
                    pattern[i * 2] = code & 0xFF;
                    pattern[i * 2 + 1] = (code >> 8) & 0xFF;
                }
                matchLen = pattern.length;
                for (let i = 0; i <= buffer.length - pattern.length; i++) {
                    let match = true;
                    for (let j = 0; j < pattern.length; j++) {
                        if (buffer[i + j] !== pattern[j]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) matches.push(i);
                }
            } else if (searchType === 'regex') {
                const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
                const re = new RegExp(query, 'g');
                let match;
                while ((match = re.exec(text)) !== null) {
                    matches.push(match.index);
                    // Simplify: assume 1 char = 1 byte for length in regex for now
                    if (matchLen === 0) matchLen = match[0].length;
                }
            }
        } catch (e) {
            console.error("Search error", e);
        }

        onSearch(matches, matches.length > 0 ? 0 : null, matchLen);
        if (matches.length > 0) {
            onJumpToOffset(matches[0]);
        }
    };

    const nextMatch = () => {
        if (results.length === 0) return;
        const nextIndex = currentIndex === null ? 0 : (currentIndex + 1) % results.length;
        onSearch(results, nextIndex, matchLength);
        onJumpToOffset(results[nextIndex]);
    };

    const prevMatch = () => {
        if (results.length === 0) return;
        const prevIndex = currentIndex === null ? results.length - 1 : (currentIndex - 1 + results.length) % results.length;
        onSearch(results, prevIndex, matchLength);
        onJumpToOffset(results[prevIndex]);
    };

    const renderMatchPreview = () => {
        if (currentIndex === null || results.length === 0) return null;
        const offset = results[currentIndex];
        const startLine = Math.floor(offset / 16);
        const previewLines = [];

        for (let l = startLine - 1; l <= startLine + 1; l++) {
            if (l < 0 || l * 16 >= buffer.length) continue;
            const lineOffset = l * 16;
            const lineBytes = buffer.slice(lineOffset, lineOffset + 16);
            const lineHex = [];
            for (let i = 0; i < 16; i++) {
                if (i >= lineBytes.length) {
                    lineHex.push("  ");
                    continue;
                }
                const byteOffset = lineOffset + i;
                const isMatch = byteOffset >= offset && byteOffset < offset + matchLength;
                const hex = lineBytes[i].toString(16).padStart(2, '0').toUpperCase();
                lineHex.push(isMatch ? <span className="match-highlight">{hex}</span> : hex);
            }
            previewLines.push(
                <div key={l} className={l === startLine ? "match-line" : ""}>
                    {l.toString(16).padStart(6, '0').toUpperCase()}  {lineHex.map((curr, i) => <React.Fragment key={i}>{i > 0 ? " " : ""}{curr}</React.Fragment>)}
                </div>
            );
        }

        return <div className="match-preview">{previewLines}</div>;
    };

    return (
        <div className="search-controls">
            <div className="search-row">
                <select value={searchType} onChange={(e) => setSearchType(e.target.value as any)}>
                    <option value="hex">Hex</option>
                    <option value="utf8">UTF-8</option>
                    <option value="utf16">UTF-16 LE</option>
                    <option value="regex">Regex (Text)</option>
                </select>
            </div>
            <div className="search-row">
                <input
                    type="text"
                    placeholder="Search query..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                />
                <button onClick={performSearch}>Find</button>
            </div>
            {results.length > 0 && (
                <>
                    <div className="search-row">
                        <span>{currentIndex !== null ? currentIndex + 1 : 0} / {results.length} matches</span>
                        <button onClick={prevMatch}>Prev</button>
                        <button onClick={nextMatch}>Next</button>
                    </div>
                    {renderMatchPreview()}
                </>
            )}
        </div>
    );
}

export function AnalysisTab({ buffer, onJumpToOffset }: { buffer: Uint8Array, onJumpToOffset: (offset: number) => void }) {
    const byteMapRef = React.useRef<HTMLCanvasElement>(null);
    const entropyRef = React.useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = byteMapRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.createImageData(width, height);
        const totalPixels = width * height;

        for (let i = 0; i < totalPixels; i++) {
            const offset = Math.floor(i * buffer.length / totalPixels);
            const byte = buffer[offset];
            const idx = i * 4;
            imageData.data[idx] = byte;     // R
            imageData.data[idx + 1] = byte; // G
            imageData.data[idx + 2] = byte; // B
            imageData.data[idx + 3] = 255;  // A
        }
        ctx.putImageData(imageData, 0, 0);
    }, [buffer]);

    useEffect(() => {
        const canvas = entropyRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = '#0e639c';
        ctx.beginPath();

        const windowSize = 256;
        const step = Math.max(1, Math.floor(buffer.length / width));

        for (let x = 0; x < width; x++) {
            const offset = Math.floor(x * buffer.length / width);
            const slice = buffer.slice(offset, offset + windowSize);
            const entropy = computeEntropy(slice);
            const y = height - (entropy / 8) * height;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }, [buffer]);

    const computeEntropy = (data: Uint8Array) => {
        if (data.length === 0) return 0;
        const counts = new Array(256).fill(0);
        for (const b of data) counts[b]++;
        let entropy = 0;
        for (const count of counts) {
            if (count > 0) {
                const p = count / data.length;
                entropy -= p * Math.log2(p);
            }
        }
        return entropy;
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>, ref: React.RefObject<HTMLCanvasElement>) => {
        const canvas = ref.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const offset = Math.floor((x / rect.width) * buffer.length);
        onJumpToOffset(offset);
    };

    return (
        <>
            <div className="analysis-label">Byte Map</div>
            <canvas
                ref={byteMapRef}
                className="analysis-canvas"
                width={260}
                height={100}
                onClick={(e) => handleCanvasClick(e, byteMapRef)}
                title="Click to jump to offset"
            />
            <div className="analysis-label" style={{ marginTop: '16px' }}>Entropy Graph</div>
            <canvas
                ref={entropyRef}
                className="analysis-canvas"
                width={260}
                height={100}
                onClick={(e) => handleCanvasClick(e, entropyRef)}
                title="Click to jump to offset"
            />
        </>
    );
}

export function HashingTab({ buffer, selection }: { buffer: Uint8Array, selection: [number, number] | null }) {
    const [hashes, setHashes] = useState<{ label: string, value: string }[]>([]);
    const [isComputing, setIsComputing] = useState(false);
    const [md5Ready, setMd5Ready] = useState(false);
    const [md5Compute, setMd5Compute] = useState<((data: Uint8Array) => string) | null>(null);

    useEffect(() => {
        // @ts-ignore
        import('./hex-viewer-wasm.js').then(async (m) => {
            await m.default();
            setMd5Compute(() => m.compute_md5);
            setMd5Ready(true);
        }).catch(e => console.error("Failed to load MD5 WASM", e));
    }, []);

    const computeHashes = useCallback(async (signal?: AbortSignal) => {
        setIsComputing(true);
        const data = selection ? buffer.slice(selection[0], selection[1] + 1) : buffer;
        const results: { label: string, value: string }[] = [];

        if (md5Compute) {
            results.push({ label: 'MD5', value: md5Compute(data) });
        }

        const algorithms = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
        for (const algo of algorithms) {
            if (signal?.aborted) return;
            try {
                const hashBuffer = await crypto.subtle.digest(algo, (data as Uint8Array).buffer as ArrayBuffer);
                if (signal?.aborted) return;
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                results.push({ label: algo, value: hashHex });
            } catch (e) {
                results.push({ label: algo, value: 'Error' });
            }
        }

        setHashes(results);
        setIsComputing(false);
    }, [buffer, selection, md5Compute]);

    useEffect(() => {
        const controller = new AbortController();
        computeHashes(controller.signal);
        return () => controller.abort();
    }, [computeHashes]);

    return (
        <>
            <div className="inspector-row">
                <span className="inspector-label">Target</span>
                <span className="inspector-value">{selection ? `Selection (0x${selection[0].toString(16)} - 0x${selection[1].toString(16)})` : 'Full File'}</span>
            </div>
            {hashes.map(h => (
                <div key={h.label} className="inspector-row">
                    <span className="inspector-label">{h.label}</span>
                    <span className="inspector-value" style={{ fontSize: '10px', fontFamily: 'monospace' }}>{h.value}</span>
                </div>
            ))}
        </>
    );
}

function InspectorTab({ buffer, index, selection, markers, onAddMarker, onRemoveMarker, setPreviewMarker }: { buffer: Uint8Array, index: number | null, selection: [number, number] | null, markers: Marker[], onAddMarker: (format: string, length: number, type?: 'data' | 'length', headerLength?: number) => void, onRemoveMarker: (index: number) => void, setPreviewMarker: (marker: Marker | null) => void }) {
    const [littleEndian, setLittleEndian] = useState(false);

    const targetIndex = index !== null ? index : (selection ? selection[0] : null);

    if (targetIndex === null) {
        return (
            <div className="inspector-row">Select a byte to see details</div>
        )
    }

    const view = utils.getDataView(buffer);
    const rows: { label: string, value: string, numericValue?: number | bigint, size: number }[] = [];

    const safeRead = (label: string, size: number, fn: () => number | bigint) => {
        try {
            if (targetIndex + size > buffer.length) {
                rows.push({ label, value: "N/A", size });
                return;
            }
            const val = fn();
            rows.push({
                label,
                value: typeof val === 'bigint' ? val.toString() : val.toLocaleString(),
                numericValue: val,
                size
            });
        } catch (e) {
            rows.push({ label, value: "Error", size });
        }
    };

    const selectionLength = selection ? selection[1] - selection[0] + 1 : 1;

    if (selectionLength === 1) {
        safeRead("Int8", 1, () => view.getInt8(targetIndex));
        safeRead("Uint8", 1, () => view.getUint8(targetIndex));
    }
    if (selectionLength === 2) {
        safeRead("Int16", 2, () => view.getInt16(targetIndex, littleEndian));
        safeRead("Uint16", 2, () => view.getUint16(targetIndex, littleEndian));
    }
    if (selectionLength === 4) {
        safeRead("Int32", 4, () => view.getInt32(targetIndex, littleEndian));
        safeRead("Uint32", 4, () => view.getUint32(targetIndex, littleEndian));
        safeRead("Float32", 4, () => view.getFloat32(targetIndex, littleEndian));
    }
    if (selectionLength === 8) {
        safeRead("Int64", 8, () => view.getBigInt64(targetIndex, littleEndian));
        safeRead("Uint64", 8, () => view.getBigUint64(targetIndex, littleEndian));
        safeRead("Float64", 8, () => view.getFloat64(targetIndex, littleEndian));
    }

    const varint = utils.readVarint(buffer, targetIndex);
    rows.push({
        label: "Varint",
        value: varint.value.toString() + ` (${varint.length} bytes)`,
        numericValue: varint.value,
        size: varint.length
    });

    return (
        <>
            <div className="inspector-row">
                <span className="inspector-label">Offset</span>
                <span className="inspector-value">0x{targetIndex.toString(16).toUpperCase()}</span>
            </div>
            <div className="inspector-row">
                <span className="inspector-label">Endian</span>
                <span className="inspector-value">
                    <label style={{ marginRight: '8px' }}>
                        <input type="radio" name="endian" value="le" checked={littleEndian} onChange={() => setLittleEndian(true)} /> LE
                    </label>
                    <label>
                        <input type="radio" name="endian" value="be" checked={!littleEndian} onChange={() => setLittleEndian(false)} /> BE
                    </label>
                </span>
            </div>
            {rows.map(r => (
                <div key={r.label} className="inspector-row">
                    <span className="inspector-label">{r.label}</span>
                    <span className="inspector-value">
                        {r.value}
                        <button
                            className="icon-button"
                            title="Add Marker"
                            onMouseEnter={() => setPreviewMarker({ start: targetIndex, length: r.size, format: r.label + (littleEndian ? 'le' : 'be') })}
                            onMouseLeave={() => setPreviewMarker(null)}
                            onClick={() => onAddMarker(r.label + (littleEndian ? 'le' : 'be'), r.size)}
                        >
                            M
                        </button>
                        <button
                            className="icon-button"
                            title="Treat as Length"
                            disabled={r.numericValue === undefined || (typeof r.numericValue === 'number' && r.numericValue < 0) || (typeof r.numericValue === 'bigint' && r.numericValue < 0n)}
                            onMouseEnter={() => {
                                if (r.numericValue !== undefined) {
                                    const dataLength = Number(r.numericValue);
                                    setPreviewMarker({ start: targetIndex, length: r.size + dataLength, format: 'length', type: 'length', headerLength: r.size });
                                }
                            }}
                            onMouseLeave={() => setPreviewMarker(null)}
                            onClick={() => {
                                if (r.numericValue !== undefined) {
                                    const dataLength = Number(r.numericValue);
                                    onAddMarker('length', r.size + dataLength, 'length', r.size);
                                }
                            }}
                        >
                            L
                        </button>
                    </span>
                </div>
            ))}

        </>
    )
}

function HexViewer({ buffer }: { buffer: Uint8Array }) {
    const [scrollTop, setScrollTop] = useState(0);

    const onJumpToOffset = useCallback((offset: number) => {
        const viewer = document.getElementById('hexviewer');
        if (viewer) {
            const line = Math.floor(offset / 16);
            const LINE_HEIGHT = 16;
            viewer.scrollTop = line * LINE_HEIGHT;
            setScrollTop(viewer.scrollTop);
        }
    }, []);

    const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [previewMarker, setPreviewMarker] = useState<Marker | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [searchResults, setSearchResults] = useState<number[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState<number | null>(null);
    const [matchLength, setMatchLength] = useState(0);

    const searchResultOffsets = React.useMemo(() => {
        const set = new Set<number>();
        for (const start of searchResults) {
            for (let i = 0; i < matchLength; i++) {
                set.add(start + i);
            }
        }
        return set;
    }, [searchResults, matchLength]);

    const selection: [number, number] | null = selectionStart !== null && selectionEnd !== null ? [Math.min(selectionStart, selectionEnd), Math.max(selectionStart, selectionEnd)] : null;

    const onMouseDown = useCallback((index: number) => {
        setSelectionStart(index);
        setSelectionEnd(index);
        setIsSelecting(true);
    }, []);

    const onMouseEnter = useCallback((index: number) => {
        setHoverIndex(index);
        if (isSelecting) {
            setSelectionEnd(index);
        }
    }, [isSelecting]);

    const onMouseLeave = useCallback(() => {
        setHoverIndex(null);
    }, []);

    const onSetSelection = useCallback((start: number, end: number) => {
        setSelectionStart(start);
        setSelectionEnd(end);
        onJumpToOffset(start);
    }, [onJumpToOffset]);

    const onAddMarker = useCallback((format: string, length: number, type: 'data' | 'length' = 'data', headerLength?: number) => {
        const start = selection !== null ? selection[0] : hoverIndex;
        if (start !== null) {
            setMarkers([...markers, { start, length, format, type, headerLength }]);
        }
    }, [markers, selection, hoverIndex]);

    const onRemoveMarker = useCallback((index: number) => {
        setMarkers(markers.filter((_, i) => i !== index));
    }, [markers]);

    useEffect(() => {
        const onMouseUp = () => setIsSelecting(false);
        window.addEventListener('mouseup', onMouseUp);
        return () => window.removeEventListener('mouseup', onMouseUp);
    }, []);

    const lineCount = Math.ceil(buffer.length / 16)

    const [sidebarWidth, setSidebarWidth] = useState(300);
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= 200 && newWidth <= window.innerWidth * 0.7) {
                setSidebarWidth(newWidth);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    return (
        <div style={{ display: 'flex', height: '100%', userSelect: isResizing ? 'none' : 'auto' }}>
            <div id="hexviewer" style={{ flex: 1, overflowY: 'auto' }} onScroll={onScroll}>
                <Column id="offset" lineCount={lineCount} scrollTop={scrollTop}
                    header="Offset"
                    render={(i) => <div key={i}>{offset(i, buffer)}</div>} />
                <Column id="hex" lineCount={lineCount} scrollTop={scrollTop}
                    header="00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F"
                    render={(i) => <div key={i}>{renderHex(i, buffer, { hoverIndex, selectionStart, selectionEnd, markers, previewMarker, searchResultOffsets, currentMatchOffset: currentMatchIndex !== null ? searchResults[currentMatchIndex] : null, matchLength, onMouseDown, onMouseEnter, onMouseLeave })}</div>} />
                <Column id="ascii" lineCount={lineCount} scrollTop={scrollTop}
                    header=" "
                    render={(i) => <div key={i}>{renderAscii(i, buffer, { hoverIndex, selectionStart, selectionEnd, markers, previewMarker, searchResultOffsets, currentMatchOffset: currentMatchIndex !== null ? searchResults[currentMatchIndex] : null, matchLength, onMouseDown, onMouseEnter, onMouseLeave })}</div>} />
            </div>
            <div id="resize-handle" onMouseDown={startResizing} />
            <div id="inspector-container" style={{ width: sidebarWidth, display: 'flex' }}>
                <DataInspector
                    buffer={buffer}
                    index={hoverIndex}
                    selection={selection}
                    markers={markers}
                    onAddMarker={onAddMarker}
                    onRemoveMarker={onRemoveMarker}
                    setPreviewMarker={setPreviewMarker}
                    onJumpToOffset={onJumpToOffset}
                    searchResults={searchResults}
                    currentMatchIndex={currentMatchIndex}
                    matchLength={matchLength}
                    onSearch={(results, index, length) => {
                        setSearchResults(results);
                        setCurrentMatchIndex(index);
                        setMatchLength(length);
                    }}
                    onSetSelection={onSetSelection}
                />
            </div>
        </div>
    )
}

function Column({ id, render, lineCount, header, scrollTop }: { id: string, render: (i: number) => ReactNode, lineCount: number, header: string, scrollTop: number }) {
    const [height, setHeight] = useState(window.innerHeight);

    useEffect(() => {
        const viewer = document.getElementById('hexviewer');
        if (viewer) {
            setHeight(viewer.clientHeight);
            const ro = new ResizeObserver(() => setHeight(viewer.clientHeight));
            ro.observe(viewer);
            return () => ro.disconnect();
        }
    }, []);

    const LINE_HEIGHT = 16;
    const adjustedOffset = scrollTop - LINE_HEIGHT * 2; // for the header row
    let visibleRange = [Math.floor(adjustedOffset / LINE_HEIGHT), Math.ceil((adjustedOffset + height + 16) / LINE_HEIGHT)]
    const OFF_SCREEN_RENDER = 50;
    visibleRange = [Math.max(0, visibleRange[0] - OFF_SCREEN_RENDER), Math.min(lineCount, visibleRange[1] + OFF_SCREEN_RENDER)]

    return (
        <pre id={id}>
            <div style={{ paddingBottom: LINE_HEIGHT, height: LINE_HEIGHT }}>{header}</div>
            <div style={{ height: visibleRange[0] * LINE_HEIGHT }}></div>
            {Array.from((function* () {
                for (let i = visibleRange[0]; i < visibleRange[1]; i++) {
                    yield render(i)
                }
            })())}
            <div style={{ height: (lineCount - visibleRange[1] + 1) * LINE_HEIGHT }}></div>
        </pre>
    )
}
