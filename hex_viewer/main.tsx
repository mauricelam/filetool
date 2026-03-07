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

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

const OUTPUT = createRoot(document.getElementById('output'))

async function handleFile(file: File) {
    const buf = new Uint8Array(await file.arrayBuffer())
    OUTPUT.render(<HexViewer buffer={buf} />)
}

function DataInspector({ buffer, index, selection, markers, onAddMarker, onRemoveMarker, setPreviewMarker }: { buffer: Uint8Array, index: number | null, selection: [number, number] | null, markers: Marker[], onAddMarker: (format: string, length: number, type?: 'data' | 'length', headerLength?: number) => void, onRemoveMarker: (index: number) => void, setPreviewMarker: (marker: Marker | null) => void }) {
    const [littleEndian, setLittleEndian] = useState(false);

    const targetIndex = index !== null ? index : (selection ? selection[0] : null);

    if (targetIndex === null) {
        return (
            <div id="inspector">
                <h3>Data Inspector</h3>
                <div className="inspector-row">Select a byte to see details</div>
            </div>
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

    safeRead("Int8", 1, () => view.getInt8(targetIndex));
    safeRead("Uint8", 1, () => view.getUint8(targetIndex));
    safeRead("Int16", 2, () => view.getInt16(targetIndex, littleEndian));
    safeRead("Uint16", 2, () => view.getUint16(targetIndex, littleEndian));
    safeRead("Int32", 4, () => view.getInt32(targetIndex, littleEndian));
    safeRead("Uint32", 4, () => view.getUint32(targetIndex, littleEndian));
    safeRead("Int64", 8, () => view.getBigInt64(targetIndex, littleEndian));
    safeRead("Uint64", 8, () => view.getBigUint64(targetIndex, littleEndian));
    safeRead("Float32", 4, () => view.getFloat32(targetIndex, littleEndian));
    safeRead("Float64", 8, () => view.getFloat64(targetIndex, littleEndian));

    const varint = utils.readVarint(buffer, targetIndex);
    rows.push({
        label: "Varint",
        value: varint.value.toString() + ` (${varint.length} bytes)`,
        numericValue: varint.value,
        size: varint.length
    });

    return (
        <div id="inspector">
            <h3>Data Inspector</h3>
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

            <h3>Markers</h3>
            <ul className="marker-list">
                {markers.map((m, i) => (
                    <li key={i} className="marker-item">
                        <span>0x{m.start.toString(16).toUpperCase()}: {m.format} ({m.length})</span>
                        <button className="icon-button" onClick={() => onRemoveMarker(i)}>X</button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function HexViewer({ buffer }: { buffer: Uint8Array }) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [previewMarker, setPreviewMarker] = useState<Marker | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);

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

    return (
        <div style={{ display: 'flex', height: '100%' }}>
            <div id="hexviewer" style={{ flex: 1, overflowY: 'auto' }}>
                <Column id="offset" lineCount={lineCount}
                    header="Offset"
                    render={(i) => <div key={i}>{offset(i, buffer)}</div>} />
                <Column id="hex" lineCount={lineCount}
                    header="00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F"
                    render={(i) => <div key={i}>{renderHex(i, buffer, { hoverIndex, selectionStart, selectionEnd, markers, previewMarker, onMouseDown, onMouseEnter, onMouseLeave })}</div>} />
                <Column id="ascii" lineCount={lineCount}
                    header=" "
                    render={(i) => <div key={i}>{renderAscii(i, buffer, { hoverIndex, selectionStart, selectionEnd, markers, previewMarker, onMouseDown, onMouseEnter, onMouseLeave })}</div>} />
            </div>
            <DataInspector buffer={buffer} index={hoverIndex} selection={selection} markers={markers} onAddMarker={onAddMarker} onRemoveMarker={onRemoveMarker} setPreviewMarker={setPreviewMarker} />
        </div>
    )
}

function Column({ id, render, lineCount, header }: { id: string, render: (i: number) => ReactNode, lineCount: number, header: string }) {
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const onScroll = () => { setOffset(window.scrollY) }
        window.removeEventListener('scroll', onScroll)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, []);

    const LINE_HEIGHT = 16;
    const adjustedOffset = offset - LINE_HEIGHT * 2; // for the header row
    let visibleRange = [Math.floor(adjustedOffset / LINE_HEIGHT), Math.ceil((adjustedOffset + window.innerHeight + 16) / LINE_HEIGHT)]
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
