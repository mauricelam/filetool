import { createRoot } from 'react-dom/client'
import { offset, renderAscii, renderHex } from './hex'
import React, { ReactNode, useCallback, useEffect, useState } from 'react'
import * as utils from './data-utils'

export interface Marker {
    start: number;
    length: number;
    format: string;
    type?: 'data' | 'length';
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

function DataInspector({ buffer, index, selection, onAddMarker }: { buffer: Uint8Array, index: number | null, selection: [number, number] | null, onAddMarker: (format: string, length: number, type?: 'data' | 'length') => void }) {
    const [littleEndian, setLittleEndian] = useState(true);
    const [format, setFormat] = useState('uint32');

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
    const rows: { label: string, value: string, numericValue?: number | bigint }[] = [];

    const safeRead = (label: string, size: number, fn: () => number | bigint) => {
        try {
            if (targetIndex + size > buffer.length) {
                rows.push({ label, value: "N/A" });
                return;
            }
            const val = fn();
            rows.push({
                label,
                value: typeof val === 'bigint' ? val.toString() : val.toLocaleString(),
                numericValue: val
            });
        } catch (e) {
            rows.push({ label, value: "Error" });
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
        numericValue: varint.value
    });

    const currentFormatValue = rows.find(r => r.label.toLowerCase() === format.toLowerCase())?.numericValue;

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
                    <span className="inspector-value">{r.value}</span>
                </div>
            ))}

            <h3>Markers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                    <option value="uint8">Uint8</option>
                    <option value="uint16">Uint16</option>
                    <option value="uint32">Uint32</option>
                    <option value="uint64">Uint64</option>
                    <option value="varint">Varint</option>
                </select>
                <button onClick={() => {
                    let length = 0;
                    if (format === 'uint8') length = 1;
                    else if (format === 'uint16') length = 2;
                    else if (format === 'uint32') length = 4;
                    else if (format === 'uint64') length = 8;
                    else if (format === 'varint') length = varint.length;
                    onAddMarker(format + (littleEndian ? 'le' : 'be'), length);
                }}>Add Marker at 0x{targetIndex.toString(16).toUpperCase()}</button>

                <button
                    disabled={currentFormatValue === undefined}
                    onClick={() => {
                        let headerLength = 0;
                        if (format === 'uint8') headerLength = 1;
                        else if (format === 'uint16') headerLength = 2;
                        else if (format === 'uint32') headerLength = 4;
                        else if (format === 'uint64') headerLength = 8;
                        else if (format === 'varint') headerLength = varint.length;

                        const dataLength = Number(currentFormatValue);
                        onAddMarker('length', headerLength + dataLength, 'length');
                    }}
                >
                    Treat as Length
                </button>
            </div>
        </div>
    )
}

function HexViewer({ buffer }: { buffer: Uint8Array }) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [isSelecting, setIsSelecting] = useState(false);

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

    const onAddMarker = useCallback((format: string, length: number, type: 'data' | 'length' = 'data') => {
        const start = selectionStart !== null ? selectionStart : hoverIndex;
        if (start !== null) {
            setMarkers([...markers, { start, length, format, type }]);
        }
    }, [markers, selectionStart, hoverIndex]);

    useEffect(() => {
        const onMouseUp = () => setIsSelecting(false);
        window.addEventListener('mouseup', onMouseUp);
        return () => window.removeEventListener('mouseup', onMouseUp);
    }, []);

    const lineCount = Math.ceil(buffer.length / 16)
    const selection: [number, number] | null = selectionStart !== null && selectionEnd !== null ? [Math.min(selectionStart, selectionEnd), Math.max(selectionStart, selectionEnd)] : null;

    return (
        <div style={{ display: 'flex', height: '100%' }}>
            <div id="hexviewer" style={{ flex: 1, overflowY: 'auto' }}>
                <Column id="offset" lineCount={lineCount}
                    header="Offset"
                    render={(i) => <div key={i}>{offset(i, buffer)}</div>} />
                <Column id="hex" lineCount={lineCount}
                    header="00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F"
                    render={(i) => <div key={i}>{renderHex(i, buffer, { hoverIndex, selectionStart, selectionEnd, markers, onMouseDown, onMouseEnter, onMouseLeave })}</div>} />
                <Column id="ascii" lineCount={lineCount}
                    header=" "
                    render={(i) => <div key={i}>{renderAscii(i, buffer, { hoverIndex, selectionStart, selectionEnd, markers, onMouseDown, onMouseEnter, onMouseLeave })}</div>} />
            </div>
            <DataInspector buffer={buffer} index={hoverIndex} selection={selection} onAddMarker={onAddMarker} />
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
