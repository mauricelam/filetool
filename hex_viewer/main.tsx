import { createRoot } from 'react-dom/client'
import { offset, renderAscii, renderHex } from './hex'
import React, { ReactNode, useCallback, useEffect, useState } from 'react'
import * as utils from './data-utils'

export interface Marker {
    start: number;
    length: number;
    format: string;
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

function DataInspector({ buffer, index, selection, onAddMarker }: { buffer: Uint8Array, index: number | null, selection: [number, number] | null, onAddMarker: (format: string, length: number) => void }) {
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

    const rows = [];
    const safeRead = (fn: Function, size: number) => {
        try {
            if (targetIndex + size > buffer.length) return "N/A";
            const val = fn(buffer, targetIndex, littleEndian);
            return typeof val === 'bigint' ? val.toString() : val.toLocaleString();
        } catch (e) {
            return "Error";
        }
    };

    rows.push({ label: "Int8", value: safeRead(utils.readInt8, 1) });
    rows.push({ label: "Uint8", value: safeRead(utils.readUint8, 1) });
    rows.push({ label: "Int16", value: safeRead(utils.readInt16, 2) });
    rows.push({ label: "Uint16", value: safeRead(utils.readUint16, 2) });
    rows.push({ label: "Int32", value: safeRead(utils.readInt32, 4) });
    rows.push({ label: "Uint32", value: safeRead(utils.readUint32, 4) });
    rows.push({ label: "Int64", value: safeRead(utils.readBigInt64, 8) });
    rows.push({ label: "Uint64", value: safeRead(utils.readBigUint64, 8) });
    rows.push({ label: "Float32", value: safeRead(utils.readFloat32, 4) });
    rows.push({ label: "Float64", value: safeRead(utils.readFloat64, 8) });

    const varint = utils.readVarint(buffer, targetIndex);
    rows.push({ label: "Varint", value: varint.value.toString() + ` (${varint.length} bytes)` });

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
                    <select value={littleEndian ? "le" : "be"} onChange={(e) => setLittleEndian(e.target.value === "le")}>
                        <option value="le">Little Endian</option>
                        <option value="be">Big Endian</option>
                    </select>
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
                    else if (format === 'varint') length = utils.readVarint(buffer, targetIndex).length;
                    onAddMarker(format + (littleEndian ? 'le' : 'be'), length);
                }}>Add Marker at 0x{targetIndex.toString(16).toUpperCase()}</button>
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

    const onAddMarker = useCallback((format: string, length: number) => {
        if (selectionStart !== null) {
            setMarkers([...markers, { start: selectionStart, length, format }]);
        } else if (hoverIndex !== null) {
            setMarkers([...markers, { start: hoverIndex, length, format }]);
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
