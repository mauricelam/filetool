import { createRoot } from 'react-dom/client'
import { offset, renderAscii, renderHex } from './hex'
import React, { ReactNode, useCallback, useEffect, useState, useMemo, useRef } from 'react'
import * as utils from './data-utils'

export interface Marker {
    start: number;
    length: number;
    format: string;
    type?: 'data' | 'length';
    headerLength?: number;
}

export interface OpenItem {
    buffer: Uint8Array;
    name: string;
}

if (window.parent && window.parent !== window) {
    window.parent.postMessage({ 'action': 'requestFile' }, '*')
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file, e.data.initialBuffer)
    }
}

const outputElement = document.getElementById('output');
const OUTPUT = outputElement ? createRoot(outputElement) : null

/**
 * Reads a slice of bytes from either a File or Uint8Array.
 */
async function readBytes(fileOrBuffer: File | Uint8Array, start: number, length: number): Promise<Uint8Array> {
    if (fileOrBuffer instanceof Uint8Array) {
        return fileOrBuffer.subarray(start, Math.min(fileOrBuffer.length, start + length));
    }
    const end = Math.min(fileOrBuffer.size, start + length);
    if (start >= fileOrBuffer.size || start >= end) {
        return new Uint8Array(0);
    }
    const slice = fileOrBuffer.slice(start, end);
    const ab = await slice.arrayBuffer();
    return new Uint8Array(ab);
}

/**
 * Processes incoming files for the Hex Viewer without memory size limits.
 */
async function handleFile(file: File, initialBuffer?: ArrayBuffer) {
    try {
        OUTPUT?.render(<HexViewer file={file} />);
    } catch (err) {
        console.error("Error reading file in HexViewer:", err);
        OUTPUT?.render(
            <div style={{ padding: '20px', color: '#d32f2f', fontFamily: 'sans-serif' }}>
                Failed to read file: {String(err)}
            </div>
        );
    }
}

const ICONS = {
    inspector: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
    markers: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>,
    search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
    analysis: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>,
    hashing: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
    binwalk: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v18"></path><path d="M8 3h4a4 4 0 0 1 0 8H8"></path><path d="M8 11h4a4 4 0 0 1 0 8H8"></path><path d="M2 9h3c1 0 1.5 1 3 1"></path><path d="M2 15h3c1 0 1.5-1 3-1"></path><circle cx="2" cy="9" r="1" fill="currentColor"></circle><circle cx="2" cy="15" r="1" fill="currentColor"></circle></svg>,
    copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
    open: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>,
    add: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
    chevronLeft: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
    chevronRight: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
};

function SelectionInfo({ selection, dataSource, totalSize, onSetSelection, onJumpToOffset, onOpen, onAddMarker, setPreviewMarker }: { selection: [number, number] | null, dataSource: File | Uint8Array, totalSize: number, onSetSelection: (start: number, end: number) => void, onJumpToOffset: (offset: number) => void, onOpen: (arg?: OpenItem[] | Uint8Array, name?: string) => void, onAddMarker: (format: string, length: number) => void, setPreviewMarker: (marker: Marker | null) => void }) {
    const start = selection ? selection[0] : 0;
    const end = selection ? selection[1] : 0;
    const length = selection ? end - start + 1 : 0;

    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedData, setSelectedData] = useState<Uint8Array | null>(null);

    useEffect(() => {
        if (!selection) {
            setSelectedData(null);
            return;
        }
        let cancelled = false;
        const fetchLen = isExpanded ? Math.min(length, 65536) : Math.min(length, 1024);
        readBytes(dataSource, start, fetchLen).then(data => {
            if (!cancelled) setSelectedData(data);
        });
        return () => { cancelled = true; };
    }, [selection, dataSource, start, length, isExpanded]);

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
        if (!selection || !selectedData) return "No selection";

        if (!isExpanded) {
            const hex = Array.from(selectedData.slice(0, 1024)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
            return (
                <div className="data-preview single-line" onClick={() => setIsExpanded(true)}>
                    {hex}
                </div>
            );
        } else {
            const hex = Array.from(selectedData).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
            return (
                <div className="data-preview expanded" onClick={() => setIsExpanded(false)}>
                    {hex}
                </div>
            );
        }
    };

    const handleCopyRaw = async () => {
        if (!selection) return;
        const data = await readBytes(dataSource, start, Math.min(length, 10 * 1024 * 1024));
        const text = new TextDecoder('latin1').decode(data);
        navigator.clipboard.writeText(text);
    };

    const handleCopyHex = async () => {
        if (!selection) return;
        const data = await readBytes(dataSource, start, Math.min(length, 10 * 1024 * 1024));
        const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        navigator.clipboard.writeText(hex);
    };

    return (
        <div className="selection-info">
            <div className="selection-info-row">
                <span className="inspector-label">Offset</span>
                <input type="number" value={start} onChange={onOffsetChange} min={0} max={Math.max(0, totalSize - 1)} />
            </div>
            <div className="selection-info-row">
                <span className="inspector-label">Length</span>
                <input type="number" value={length} onChange={onLengthChange} min={0} max={totalSize} />
            </div>
            <div className="selection-info-row">
                <span className="inspector-label">Hex Range</span>
                <span className="inspector-value">
                    <span className="clickable-offset" onClick={() => onJumpToOffset(start)}>0x{start.toString(16).toUpperCase()}</span>
                    {' - '}
                    <span className="clickable-offset" onClick={() => onJumpToOffset(end)}>0x{end.toString(16).toUpperCase()}</span>
                </span>
            </div>
            <div className="selection-info-row data-row">
                <span className="inspector-label">Data</span>
                <div className="inspector-value data-container">{renderSelectedData()}</div>
            </div>
            <div className="selection-actions">
                <button onClick={() => onOpen()} disabled={!selection} title="Open selection in new tab">{ICONS.open} Open</button>
                <button onMouseEnter={() => setPreviewMarker({ start, length, format: 'marker' })} onMouseLeave={() => setPreviewMarker(null)} onClick={() => onAddMarker('marker', length)} disabled={!selection} title="Add marker for selection">{ICONS.markers} Mark</button>
                <button onClick={handleCopyRaw} disabled={!selection} title="Copy as raw bytes">{ICONS.copy} Raw</button>
                <button onClick={handleCopyHex} disabled={!selection} title="Copy as hex string">{ICONS.copy} Hex</button>
            </div>
        </div>
    );
}

export function DataInspector({ dataSource, buffer, index, selection, markers, totalSize, onAddMarker, onRemoveMarker, setPreviewMarker, onJumpToOffset, searchResults, currentMatchIndex, matchLength, onSearch, onSetSelection, onOpen, binwalkResults, onSetBinwalkResults }: { dataSource: File | Uint8Array, buffer?: Uint8Array, index: number | null, selection: [number, number] | null, markers: Marker[], totalSize: number, onAddMarker: (format: string, length: number, type?: 'data' | 'length', headerLength?: number, forcedStart?: number) => void, onRemoveMarker: (index: number) => void, setPreviewMarker: (marker: Marker | null) => void, onJumpToOffset: (offset: number) => void, searchResults: number[], currentMatchIndex: number | null, matchLength: number, onSearch: (results: number[], index: number | null, matchLength: number) => void, onSetSelection: (start: number, end: number) => void, onOpen: (arg?: OpenItem[] | Uint8Array, name?: string) => void, binwalkResults: BinwalkResult[] | null, onSetBinwalkResults: (results: BinwalkResult[] | null) => void }) {
    const [activeTab, setActiveTab] = useState<'inspector' | 'search' | 'analysis' | 'markers' | 'binwalk'>('inspector');

    const handleJumpAndSelect = (offset: number, length: number = 0) => {
        onJumpToOffset(offset);
        onSetSelection(offset, offset + Math.max(0, length - 1));
    };

    return (
        <div id="inspector" style={{ width: '100%' }}>
            <SelectionInfo selection={selection} dataSource={dataSource} totalSize={totalSize} onSetSelection={onSetSelection} onJumpToOffset={onJumpToOffset} onOpen={() => onOpen()} onAddMarker={onAddMarker} setPreviewMarker={setPreviewMarker} />
            <div className="tab-header">
                <button className={`tab-button ${activeTab === 'inspector' ? 'active' : ''}`} onClick={() => setActiveTab('inspector')} title="Inspector">
                    {ICONS.inspector}
                    <span className="tab-label">Inspect</span>
                </button>
                <button className={`tab-button ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')} title="Search">
                    {ICONS.search}
                    <span className="tab-label">Search</span>
                </button>
                <button className={`tab-button ${activeTab === 'binwalk' ? 'active' : ''}`} onClick={() => setActiveTab('binwalk')} title="Binwalk">
                    {ICONS.binwalk}
                    <span className="tab-label">Binwalk</span>
                </button>
                <button className={`tab-button ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')} title="Analysis">
                    {ICONS.analysis}
                    <span className="tab-label">Analysis</span>
                </button>
                <button className={`tab-button ${activeTab === 'markers' ? 'active' : ''}`} onClick={() => setActiveTab('markers')} title="Markers">
                    {ICONS.markers}
                    {markers.length > 0 && <span className="tab-badge">{markers.length}</span>}
                    <span className="tab-label">Markers</span>
                </button>
            </div>
            <div className="tab-content">
                {activeTab === 'inspector' && (
                    <InspectorTab
                        dataSource={dataSource}
                        buffer={buffer}
                        totalSize={totalSize}
                        index={index}
                        selection={selection}
                        markers={markers}
                        onAddMarker={onAddMarker}
                        onRemoveMarker={onRemoveMarker}
                        setPreviewMarker={setPreviewMarker}
                    />
                )}
                {activeTab === 'search' && <SearchTab dataSource={dataSource} totalSize={totalSize} buffer={buffer} results={searchResults} currentIndex={currentMatchIndex} matchLength={matchLength} onSearch={onSearch} onJumpToOffset={onJumpToOffset} />}
                {activeTab === 'markers' && <MarkersTab markers={markers} onRemoveMarker={onRemoveMarker} onJumpToOffset={onJumpToOffset} />}
                {activeTab === 'analysis' && <AnalysisTab dataSource={dataSource} totalSize={totalSize} buffer={buffer} onJumpToOffset={handleJumpAndSelect} />}
                {activeTab === 'binwalk' && <BinwalkTab dataSource={dataSource} totalSize={totalSize} buffer={buffer} results={binwalkResults} onSetResults={onSetBinwalkResults} onJumpToOffset={handleJumpAndSelect} onAddMarker={onAddMarker} onOpen={(items) => onOpen(items)} />}
            </div>
        </div>
    );
}

interface BinwalkResult {
    offset: number;
    description: string;
    length: number;
    confidence: number;
}

function BinwalkTab({ dataSource, totalSize, buffer, results, onSetResults, onJumpToOffset, onAddMarker, onOpen }: { dataSource: File | Uint8Array, totalSize: number, buffer?: Uint8Array, results: BinwalkResult[] | null, onSetResults: (results: BinwalkResult[] | null) => void, onJumpToOffset: (offset: number, length?: number) => void, onAddMarker: (format: string, length: number, type?: 'data' | 'length', headerLength?: number, forcedStart?: number) => void, onOpen: (arg?: OpenItem[] | Uint8Array, name?: string) => void }) {
    const [loading, setLoading] = useState(false);
    const [fullSearch, setFullSearch] = useState(false);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    useEffect(() => {
        setSelectedIndices(new Set());
    }, [results]);

    const performScan = useCallback(async () => {
        if (results) return;
        setLoading(true);
        try {
            // @ts-ignore
            const m = await import('./hex-viewer-wasm.js');
            await m.default();
            const scanner = new m.BinwalkScanner(fullSearch);

            const allResults: BinwalkResult[] = [];
            const seenOffsets = new Set<number>();

            const CHUNK_SIZE = 32 * 1024 * 1024; // 32 MB chunks
            const OVERLAP = 64 * 1024; // 64 KB overlap
            let scanOffset = 0;

            while (scanOffset < totalSize) {
                const chunkLen = Math.min(totalSize - scanOffset, CHUNK_SIZE);
                const chunkData = await readBytes(dataSource, scanOffset, chunkLen);
                if (chunkData.length === 0) break;

                const chunkResults = scanner.scan(chunkData) as BinwalkResult[];
                for (const r of chunkResults) {
                    const globalOffset = scanOffset + r.offset;
                    if (!seenOffsets.has(globalOffset)) {
                        seenOffsets.add(globalOffset);
                        allResults.push({
                            ...r,
                            offset: globalOffset
                        });
                    }
                }

                if (scanOffset + chunkLen >= totalSize) break;
                scanOffset += (CHUNK_SIZE - OVERLAP);
                await new Promise(res => setTimeout(res, 0));
            }

            allResults.sort((a, b) => a.offset - b.offset);
            onSetResults(allResults);
        } catch (e) {
            console.error("Binwalk scan failed", e);
        } finally {
            setLoading(false);
        }
    }, [dataSource, totalSize, results, onSetResults, fullSearch]);

    useEffect(() => {
        if (!results && !loading) {
            performScan();
        }
    }, [results, loading, performScan]);

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 200) return '#4caf50'; // Green
        if (confidence >= 100) return '#ff9800'; // Orange
        return '#f44336'; // Red
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked && results) {
            setSelectedIndices(new Set(results.keys()));
        } else {
            setSelectedIndices(new Set());
        }
    };

    const toggleSelect = (i: number, e: React.MouseEvent | React.ChangeEvent) => {
        e.stopPropagation();
        const next = new Set(selectedIndices);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        setSelectedIndices(next);
    };

    const handleOpenSelected = async () => {
        if (!results) return;
        const selectedList = Array.from(selectedIndices)
            .map(i => results[i])
            .sort((a, b) => a.offset - b.offset);

        const items: OpenItem[] = [];
        for (const r of selectedList) {
            const name = `binwalk_0x${r.offset.toString(16)}_${r.description.replace(/[^a-z0-9]/gi, '_').slice(0, 32)}.bin`;
            const data = await readBytes(dataSource, r.offset, r.length);
            items.push({ buffer: data, name });
        }
        onOpen(items);
    };

    return (
        <div className="binwalk-tab">
            <div className="binwalk-options">
                <label className="binwalk-option">
                    <input
                        type="checkbox"
                        checked={fullSearch}
                        onChange={(e) => {
                            setFullSearch(e.target.checked);
                            onSetResults(null);
                        }}
                    />
                    Search all signatures
                </label>
            </div>
            {results && results.length > 0 && (
                <div className="binwalk-actions">
                    <label className="binwalk-option">
                        <input
                            type="checkbox"
                            checked={results.length > 0 && selectedIndices.size === results.length}
                            onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                        Select All
                    </label>
                    <button
                        className="binwalk-action-button"
                        disabled={selectedIndices.size === 0}
                        onClick={handleOpenSelected}
                    >
                        {ICONS.open} Open {selectedIndices.size > 0 ? `(${selectedIndices.size})` : ''}
                    </button>
                </div>
            )}
            {loading && <div className="loading">Scanning with Binwalk...</div>}
            {!loading && results && results.length === 0 && <div className="no-results">No signatures found. {fullSearch ? "" : "Try searching all signatures."}</div>}
            {!loading && results && results.length > 0 && (
                <div className="binwalk-results">
                    {results.map((r, i) => (
                        <div key={i} className={`binwalk-result-item ${selectedIndices.has(i) ? 'selected' : ''}`} onClick={() => onJumpToOffset(r.offset, r.length)}>
                            <div className="binwalk-result-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIndices.has(i)}
                                        onChange={(e) => toggleSelect(i, e)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="clickable-offset">0x{r.offset.toString(16).toUpperCase()} ({r.offset})</span>
                                </div>
                                <div className="confidence-signal" style={{ color: getConfidenceColor(r.confidence) }} title={`Confidence: ${r.confidence}`}>
                                    <div className={`confidence-bar active`} />
                                    <div className={`confidence-bar ${r.confidence >= 100 ? 'active' : ''}`} />
                                    <div className={`confidence-bar ${r.confidence >= 200 ? 'active' : ''}`} />
                                </div>
                            </div>
                            <div className="binwalk-description">{r.description}</div>
                        </div>
                    ))}
                </div>
            )}
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

export function SearchTab({ dataSource, totalSize, buffer, results, currentIndex, matchLength, onSearch, onJumpToOffset }: { dataSource?: File | Uint8Array, totalSize?: number, buffer?: Uint8Array, results: number[], currentIndex: number | null, matchLength: number, onSearch: (results: number[], index: number | null, matchLength: number) => void, onJumpToOffset: (offset: number) => void }) {
    const src = dataSource || buffer || new Uint8Array(0);
    const size = totalSize !== undefined ? totalSize : (src instanceof Uint8Array ? src.length : src.size);

    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState<'hex' | 'utf8' | 'utf16' | 'regex'>('hex');
    const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);

    const performSearch = async () => {
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

                const CHUNK_SIZE = 16 * 1024 * 1024;
                let scanOffset = 0;
                while (scanOffset < size) {
                    const chunkLen = Math.min(size - scanOffset, CHUNK_SIZE);
                    const chunk = await readBytes(src, scanOffset, chunkLen);

                    for (let i = 0; i <= chunk.length - pattern.length; i++) {
                        let match = true;
                        for (let j = 0; j < pattern.length; j++) {
                            if (chunk[i + j] !== pattern[j]) {
                                match = false;
                                break;
                            }
                        }
                        if (match) matches.push(scanOffset + i);
                    }

                    if (scanOffset + chunkLen >= size) break;
                    scanOffset += (CHUNK_SIZE - pattern.length + 1);
                }
            } else if (searchType === 'utf8') {
                const pattern = new TextEncoder().encode(query);
                matchLen = pattern.length;

                const CHUNK_SIZE = 16 * 1024 * 1024;
                let scanOffset = 0;
                while (scanOffset < size) {
                    const chunkLen = Math.min(size - scanOffset, CHUNK_SIZE);
                    const chunk = await readBytes(src, scanOffset, chunkLen);

                    for (let i = 0; i <= chunk.length - pattern.length; i++) {
                        let match = true;
                        for (let j = 0; j < pattern.length; j++) {
                            if (chunk[i + j] !== pattern[j]) {
                                match = false;
                                break;
                            }
                        }
                        if (match) matches.push(scanOffset + i);
                    }

                    if (scanOffset + chunkLen >= size) break;
                    scanOffset += (CHUNK_SIZE - pattern.length + 1);
                }
            } else if (searchType === 'utf16') {
                const pattern = new Uint8Array(query.length * 2);
                for (let i = 0; i < query.length; i++) {
                    const code = query.charCodeAt(i);
                    pattern[i * 2] = code & 0xFF;
                    pattern[i * 2 + 1] = (code >> 8) & 0xFF;
                }
                matchLen = pattern.length;

                const CHUNK_SIZE = 16 * 1024 * 1024;
                let scanOffset = 0;
                while (scanOffset < size) {
                    const chunkLen = Math.min(size - scanOffset, CHUNK_SIZE);
                    const chunk = await readBytes(src, scanOffset, chunkLen);

                    for (let i = 0; i <= chunk.length - pattern.length; i++) {
                        let match = true;
                        for (let j = 0; j < pattern.length; j++) {
                            if (chunk[i + j] !== pattern[j]) {
                                match = false;
                                break;
                            }
                        }
                        if (match) matches.push(scanOffset + i);
                    }

                    if (scanOffset + chunkLen >= size) break;
                    scanOffset += (CHUNK_SIZE - pattern.length + 1);
                }
            } else if (searchType === 'regex') {
                const fullBuffer = await readBytes(src, 0, Math.min(size, 64 * 1024 * 1024));
                const text = new TextDecoder('utf-8', { fatal: false }).decode(fullBuffer);
                const re = new RegExp(query, 'g');
                let match;
                while ((match = re.exec(text)) !== null) {
                    matches.push(match.index);
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

    const currentOffset = currentIndex !== null && results.length > 0 ? results[currentIndex] : null;

    useEffect(() => {
        if (currentOffset === null) {
            setPreviewBytes(null);
            return;
        }
        let cancelled = false;
        const startLine = Math.floor(currentOffset / 16);
        const startOffset = Math.max(0, (startLine - 1) * 16);
        readBytes(src, startOffset, 64).then(bytes => {
            if (!cancelled) setPreviewBytes(bytes);
        });
        return () => { cancelled = true; };
    }, [src, currentOffset]);

    const renderMatchPreview = () => {
        if (currentIndex === null || results.length === 0 || previewBytes === null) return null;
        const offsetVal = results[currentIndex];
        const startLine = Math.floor(offsetVal / 16);
        const previewLines = [];

        for (let l = startLine - 1; l <= startLine + 1; l++) {
            if (l < 0 || l * 16 >= size) continue;
            const lineOffset = l * 16;
            const startFetchOffset = Math.max(0, (startLine - 1) * 16);
            const relativeLineOffset = lineOffset - startFetchOffset;
            const lineBytes = previewBytes.subarray(relativeLineOffset, relativeLineOffset + 16);

            const lineHex = [];
            for (let i = 0; i < 16; i++) {
                if (i >= lineBytes.length) {
                    lineHex.push("  ");
                    continue;
                }
                const byteOffset = lineOffset + i;
                const isMatch = byteOffset >= offsetVal && byteOffset < offsetVal + matchLength;
                const hex = lineBytes[i].toString(16).padStart(2, '0').toUpperCase();
                lineHex.push(isMatch ? <span key={i} className="match-highlight">{hex}</span> : hex);
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

export function AnalysisTab({ dataSource, totalSize, buffer, onJumpToOffset }: { dataSource?: File | Uint8Array, totalSize?: number, buffer?: Uint8Array, onJumpToOffset: (offset: number) => void }) {
    const src = dataSource || buffer || new Uint8Array(0);
    const size = totalSize !== undefined ? totalSize : (src instanceof Uint8Array ? src.length : src.size);

    const byteMapRef = React.useRef<HTMLCanvasElement>(null);
    const entropyRef = React.useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = byteMapRef.current;
        if (!canvas || size === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let cancelled = false;
        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.createImageData(width, height);
        const totalPixels = width * height;

        (async () => {
            const step = Math.max(1, Math.floor(size / totalPixels));
            const sampleLen = Math.min(size, totalPixels * step);
            const samples = await readBytes(src, 0, sampleLen);
            if (cancelled) return;

            for (let i = 0; i < totalPixels; i++) {
                const offsetVal = Math.floor(i * size / totalPixels);
                const byte = samples[offsetVal] || 0;
                const idx = i * 4;
                imageData.data[idx] = byte;     // R
                imageData.data[idx + 1] = byte; // G
                imageData.data[idx + 2] = byte; // B
                imageData.data[idx + 3] = 255;  // A
            }
            ctx.putImageData(imageData, 0, 0);
        })();

        return () => { cancelled = true; };
    }, [src, size]);

    useEffect(() => {
        const canvas = entropyRef.current;
        if (!canvas || size === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let cancelled = false;
        const width = canvas.width;
        const height = canvas.height;

        (async () => {
            const windowSize = 256;
            ctx.clearRect(0, 0, width, height);
            ctx.strokeStyle = '#0e639c';
            ctx.beginPath();

            for (let x = 0; x < width; x++) {
                const offsetVal = Math.floor(x * size / width);
                const slice = await readBytes(src, offsetVal, windowSize);
                if (cancelled) return;
                const entropy = computeEntropy(slice);
                const y = height - (entropy / 8) * height;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        })();

        return () => { cancelled = true; };
    }, [src, size]);

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
        const offsetVal = Math.floor((x / rect.width) * size);
        onJumpToOffset(offsetVal);
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

export function HashingTab({ dataSource, totalSize, buffer, selection }: { dataSource?: File | Uint8Array, totalSize?: number, buffer?: Uint8Array, selection: [number, number] | null }) {
    const src = dataSource || buffer || new Uint8Array(0);
    const size = totalSize !== undefined ? totalSize : (src instanceof Uint8Array ? src.length : src.size);

    const [hashes, setHashes] = useState<{ label: string, value: string }[]>([]);
    const [isComputing, setIsComputing] = useState(false);
    const workerRef = React.useRef<Worker | null>(null);
    const requestIdRef = React.useRef(0);

    useEffect(() => {
        const workerUrl = new URL('./hash-worker.js', window.location.href);
        workerRef.current = new Worker(workerUrl, { type: 'module' });
        workerRef.current.onmessage = (e) => {
            if (e.data.id === requestIdRef.current) {
                setHashes(e.data.results);
                setIsComputing(false);
            }
        };
        return () => workerRef.current?.terminate();
    }, []);

    useEffect(() => {
        if (!workerRef.current) return;

        setIsComputing(true);
        const id = ++requestIdRef.current;
        const algorithms = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

        const start = selection ? selection[0] : 0;
        const len = selection ? (selection[1] - selection[0] + 1) : Math.min(size, 256 * 1024 * 1024);

        readBytes(src, start, len).then(data => {
            const dataCopy = data.slice();
            workerRef.current?.postMessage({ data: dataCopy, algorithms, id }, [dataCopy.buffer]);
        });
    }, [src, size, selection]);

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

export function InspectorTab({ dataSource, totalSize, buffer, index, selection, markers, onAddMarker, onRemoveMarker, setPreviewMarker }: { dataSource?: File | Uint8Array, totalSize?: number, buffer?: Uint8Array, index: number | null, selection: [number, number] | null, markers: Marker[], onAddMarker: (format: string, length: number, type?: 'data' | 'length', headerLength?: number, forcedStart?: number) => void, onRemoveMarker: (index: number) => void, setPreviewMarker: (marker: Marker | null) => void }) {
    const src = dataSource || buffer || new Uint8Array(0);
    const size = totalSize !== undefined ? totalSize : (src instanceof Uint8Array ? src.length : src.size);

    const [littleEndian, setLittleEndian] = useState(false);
    const [hashes, setHashes] = useState<{ label: string, value: string }[]>([]);
    const [isComputing, setIsComputing] = useState(false);
    const [targetBytes, setTargetBytes] = useState<Uint8Array | null>(null);
    const workerRef = React.useRef<Worker | null>(null);
    const requestIdRef = React.useRef(0);

    const targetIndex = index !== null ? index : (selection ? selection[0] : null);

    useEffect(() => {
        if (targetIndex === null) {
            setTargetBytes(null);
            return;
        }
        let cancelled = false;
        readBytes(src, targetIndex, 16).then(bytes => {
            if (!cancelled) setTargetBytes(bytes);
        });
        return () => { cancelled = true; };
    }, [src, targetIndex]);

    useEffect(() => {
        const workerUrl = new URL('./hash-worker.js', window.location.href);
        workerRef.current = new Worker(workerUrl, { type: 'module' });
        workerRef.current.onmessage = (e) => {
            if (e.data.id === requestIdRef.current) {
                setHashes(e.data.results);
                setIsComputing(false);
            }
        };
        return () => workerRef.current?.terminate();
    }, []);

    useEffect(() => {
        if (!workerRef.current) return;

        setIsComputing(true);
        const id = ++requestIdRef.current;
        const algorithms = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

        const start = selection ? selection[0] : 0;
        const len = selection ? (selection[1] - selection[0] + 1) : Math.min(size, 256 * 1024 * 1024);

        readBytes(src, start, len).then(data => {
            const dataCopy = data.slice();
            workerRef.current?.postMessage({ data: dataCopy, algorithms, id }, [dataCopy.buffer]);
        });
    }, [src, size, selection]);

    if (targetIndex === null || !targetBytes) {
        return (
            <div className="inspector-row">Select a byte to see details</div>
        )
    }

    const view = utils.getDataView(targetBytes);
    const rows: { label: string, value: string, numericValue?: number | bigint, size: number }[] = [];

    const safeRead = (label: string, reqSize: number, fn: () => number | bigint) => {
        try {
            if (reqSize > targetBytes.length) {
                rows.push({ label, value: "N/A", size: reqSize });
                return;
            }
            const val = fn();
            rows.push({
                label,
                value: typeof val === 'bigint' ? val.toString() : val.toLocaleString(),
                numericValue: val,
                size: reqSize
            });
        } catch (e) {
            rows.push({ label, value: "Error", size: reqSize });
        }
    };

    const selectionLength = selection ? selection[1] - selection[0] + 1 : 1;

    if (selectionLength === 1) {
        safeRead("Int8", 1, () => view.getInt8(0));
        safeRead("Uint8", 1, () => view.getUint8(0));
    }
    if (selectionLength === 2) {
        safeRead("Int16", 2, () => view.getInt16(0, littleEndian));
        safeRead("Uint16", 2, () => view.getUint16(0, littleEndian));
    }
    if (selectionLength === 4) {
        safeRead("Int32", 4, () => view.getInt32(0, littleEndian));
        safeRead("Uint32", 4, () => view.getUint32(0, littleEndian));
        safeRead("Float32", 4, () => view.getFloat32(0, littleEndian));
    }
    if (selectionLength === 8) {
        safeRead("Int64", 8, () => view.getBigInt64(0, littleEndian));
        safeRead("Uint64", 8, () => view.getBigUint64(0, littleEndian));
        safeRead("Float64", 8, () => view.getFloat64(0, littleEndian));
    }

    const varint = utils.readVarint(targetBytes, 0);
    rows.push({
        label: "Varint",
        value: varint.value.toString() + ` (${varint.length} bytes)`,
        numericValue: varint.value,
        size: varint.length
    });

    return (
        <>
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
                            {ICONS.markers}
                        </button>
                    </span>
                </div>
            ))}

            <div className="inspector-hashes" style={{ marginTop: '16px' }}>
                <div className="inspector-row">
                    <span className="inspector-label">Hashes ({selection ? 'Selection' : 'Full File'})</span>
                </div>
                {hashes.map(h => (
                    <div key={h.label} className="inspector-row">
                        <span className="inspector-label">{h.label}</span>
                        <span className="inspector-value" style={{ fontSize: '10px', fontFamily: 'monospace' }}>{h.value}</span>
                    </div>
                ))}
            </div>
        </>
    )
}

function HexViewer({ file, buffer, initialBuffer, totalSize: propTotalSize }: { file?: File, buffer?: Uint8Array, initialBuffer?: ArrayBuffer, totalSize?: number }) {
    const dataSource = file || buffer || new Uint8Array(initialBuffer || new ArrayBuffer(0));
    const totalSize = propTotalSize !== undefined ? propTotalSize : (file ? file.size : (buffer ? buffer.length : (initialBuffer ? initialBuffer.byteLength : 0)));

    const [scrollTop, setScrollTop] = useState(0);

    const lineCount = Math.ceil(totalSize / 16);
    const MAX_SCROLL_HEIGHT = 10_000_000;
    const unscaledTotalHeight = lineCount * 16;
    const scale = unscaledTotalHeight > MAX_SCROLL_HEIGHT ? unscaledTotalHeight / MAX_SCROLL_HEIGHT : 1;

    const onJumpToOffset = useCallback((offsetVal: number) => {
        const viewer = document.getElementById('hexviewer');
        if (viewer) {
            const line = Math.floor(offsetVal / 16);
            const LINE_HEIGHT = 16;
            const virtualScroll = line * LINE_HEIGHT;
            viewer.scrollTop = virtualScroll / scale;
            setScrollTop(viewer.scrollTop);
        }
    }, [scale]);

    const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // Sliding Window Buffer State
    const [windowState, setWindowState] = useState<{ buffer: Uint8Array, offset: number }>({
        buffer: buffer || (initialBuffer ? new Uint8Array(initialBuffer) : new Uint8Array(0)),
        offset: 0
    });

    const virtualScrollTop = scrollTop * scale;
    const visibleStartByte = Math.max(0, Math.floor(virtualScrollTop / 16) * 16 - 50 * 16);
    const visibleEndByte = Math.min(totalSize, visibleStartByte + 200 * 16);

    useEffect(() => {
        if (buffer) {
            setWindowState({ buffer, offset: 0 });
            return;
        }

        const currOffset = windowState.offset;
        const currLen = windowState.buffer.length;
        if (currLen > 0 && visibleStartByte >= currOffset && visibleEndByte <= currOffset + currLen) {
            return; // Currently visible range is already loaded in window
        }

        let cancelled = false;
        const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB window
        const newWindowStart = Math.max(0, visibleStartByte - 512 * 1024);
        const newWindowLen = Math.min(totalSize - newWindowStart, CHUNK_SIZE);

        readBytes(dataSource, newWindowStart, newWindowLen).then(data => {
            if (!cancelled) {
                setWindowState({ buffer: data, offset: newWindowStart });
            }
        });

        return () => { cancelled = true; };
    }, [dataSource, totalSize, visibleStartByte, visibleEndByte, buffer]);

    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [previewMarker, setPreviewMarker] = useState<Marker | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [searchResults, setSearchResults] = useState<number[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState<number | null>(null);
    const [matchLength, setMatchLength] = useState(0);
    const [binwalkResults, setBinwalkResults] = useState<BinwalkResult[] | null>(null);

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

    const handleOpen = useCallback(async (arg?: OpenItem[] | Uint8Array, customName?: string) => {
        if (Array.isArray(arg)) {
            if (arg.length === 0) return;
            const first = arg[0];
            const primaryFile = new File([first.buffer.slice().buffer], first.name);
            const additionalFiles = arg.slice(1).map(item => new File([item.buffer.slice().buffer], item.name));
            window.parent.postMessage({ action: 'openFile', file: primaryFile, additionalFiles }, '*');
            return;
        }

        const start = selection ? selection[0] : 0;
        const end = selection ? selection[1] : 0;
        let data = arg instanceof Uint8Array ? arg : null;
        if (!data && selection) {
            data = await readBytes(dataSource, start, end - start + 1);
        }
        if (!data) return;
        const name = customName || `selection_0x${start.toString(16)}_0x${end.toString(16)}.bin`;
        const fileObj = new File([data.slice().buffer], name);
        window.parent.postMessage({ action: 'openFile', file: fileObj }, '*');
    }, [selection, dataSource]);

    const onAddMarker = useCallback((format: string, length: number, type: 'data' | 'length' = 'data', headerLength?: number, forcedStart?: number) => {
        const start = forcedStart !== undefined ? forcedStart : (selection !== null ? selection[0] : hoverIndex);
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

    const [sidebarWidth, setSidebarWidth] = useState(300);
    const [isResizing, setIsResizing] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 800);

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
        const handleResize = () => {
            if (window.innerWidth < 800) {
                setIsSidebarCollapsed(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    const renderState = {
        hoverIndex,
        selectionStart,
        selectionEnd,
        markers,
        previewMarker,
        searchResultOffsets,
        currentMatchOffset: currentMatchIndex !== null ? searchResults[currentMatchIndex] : null,
        matchLength,
        onMouseDown,
        onMouseEnter,
        onMouseLeave,
        bufferOffset: windowState.offset,
        totalSize
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', flex: 1, userSelect: isResizing ? 'none' : 'auto', position: 'relative', overflow: 'hidden' }}>
            <div id="hexviewer" style={{ flex: 1, overflowY: 'auto' }} onScroll={onScroll}>
                <Column id="offset" totalSize={totalSize} lineCount={lineCount} scrollTop={scrollTop} scale={scale}
                    header="Offset"
                    render={(i) => <div key={i}>{offset(i, totalSize)}</div>} />
                <Column id="hex" totalSize={totalSize} lineCount={lineCount} scrollTop={scrollTop} scale={scale}
                    header="00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F"
                    render={(i) => <div key={i}>{renderHex(i, windowState.buffer, renderState)}</div>} />
                <Column id="ascii" totalSize={totalSize} lineCount={lineCount} scrollTop={scrollTop} scale={scale}
                    header=" "
                    render={(i) => <div key={i}>{renderAscii(i, windowState.buffer, renderState)}</div>} />
            </div>
            {!isSidebarCollapsed && <div id="resize-handle" onMouseDown={startResizing} />}
            <button
                className="sidebar-toggle"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                style={{
                    right: isSidebarCollapsed ? 0 : sidebarWidth
                }}
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
                {isSidebarCollapsed ? ICONS.chevronLeft : ICONS.chevronRight}
            </button>
            <div id="inspector-container" style={{ width: sidebarWidth, display: isSidebarCollapsed ? 'none' : 'flex' }}>
                <DataInspector
                    dataSource={dataSource}
                    buffer={windowState.buffer}
                    totalSize={totalSize}
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
                    onOpen={handleOpen}
                    binwalkResults={binwalkResults}
                    onSetBinwalkResults={setBinwalkResults}
                />
            </div>
        </div>
        </div>
    )
}

function Column({ id, render, lineCount, header, scrollTop, scale, totalSize }: { id: string, render: (i: number) => ReactNode, lineCount: number, header: string, scrollTop: number, scale: number, totalSize: number }) {
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
    const virtualScrollTop = scrollTop * scale;
    const adjustedOffset = virtualScrollTop - LINE_HEIGHT * 2; // for the header row
    let visibleRange = [Math.floor(adjustedOffset / LINE_HEIGHT), Math.ceil((adjustedOffset + height + 16) / LINE_HEIGHT)]
    const OFF_SCREEN_RENDER = 50;
    visibleRange = [Math.max(0, visibleRange[0] - OFF_SCREEN_RENDER), Math.min(lineCount, visibleRange[1] + OFF_SCREEN_RENDER)]

    const topSpacerHeight = (visibleRange[0] * LINE_HEIGHT) / scale;
    const maxDOMHeight = Math.min(lineCount * LINE_HEIGHT, 10_000_000);
    const renderedDOMHeight = ((visibleRange[1] - visibleRange[0]) * LINE_HEIGHT) / scale;
    const bottomSpacerHeight = Math.max(0, maxDOMHeight - topSpacerHeight - renderedDOMHeight);

    return (
        <pre id={id}>
            <div style={{ paddingBottom: LINE_HEIGHT, height: LINE_HEIGHT }}>{header}</div>
            <div style={{ height: topSpacerHeight }}></div>
            {Array.from((function* () {
                for (let i = visibleRange[0]; i < visibleRange[1]; i++) {
                    yield render(i)
                }
            })())}
            <div style={{ height: bottomSpacerHeight }}></div>
        </pre>
    )
}
