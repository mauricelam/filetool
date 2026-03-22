import { createRoot } from 'react-dom/client'
import init, { HprofParser, HprofHeader, RecordInfo } from './hprof-wasm/pkg'
import React, { ReactElement, useState, useEffect, useMemo, useRef } from 'react'

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const rootElement = document.getElementById('output')
const root = createRoot(rootElement)

async function handleFile(file: File) {
    await init()
    const bytes = new Uint8Array(await file.arrayBuffer())
    const parser = new HprofParser(bytes)
    root.render(<HprofViewer parser={parser} fileName={file.name} />)
}

// For testing without the main app
if (window.location.search.includes('test=true')) {
    fetch('test.hprof')
        .then(r => {
            if (!r.ok) throw new Error("test.hprof not found")
            return r.arrayBuffer()
        })
        .then(buf => handleFile(new File([buf], 'test.hprof')))
        .catch(e => {
            console.error("Test load failed", e)
            root.render(<div id="error">Test load failed: {e.message}</div>)
        })
}

interface HeapSummaryEntry {
    tag: string;
    count: number;
}

const PAGE_SIZE = 100;
const SUB_RECORD_PAGE_SIZE = 50;

function HprofViewer({ parser, fileName }: { parser: HprofParser, fileName: string }): ReactElement {
    const [header, setHeader] = useState<HprofHeader | null>(null)
    const [records, setRecords] = useState<RecordInfo[]>([])
    const [totalMatchingRecords, setTotalMatchingRecords] = useState(0)
    const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null)
    const [recordDetail, setRecordDetail] = useState<string | null>(null)
    const [heapDumpSummary, setHeapDumpSummary] = useState<HeapSummaryEntry[]>([])
    const [heapDumpRecords, setHeapDumpRecords] = useState<string[]>([])
    const [heapDumpOffset, setHeapDumpOffset] = useState(0)
    const [filter, setFilter] = useState('')
    const [offset, setOffset] = useState(0)

    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            setHeader(parser.get_header())
            updateList('', 0)
        } catch (e) {
            console.error("Failed to load HPROF data", e)
        }
    }, [parser])

    const updateList = (query: string, newOffset: number) => {
        const result = parser.search_records(query, newOffset, PAGE_SIZE)
        setRecords(result.records)
        setTotalMatchingRecords(result.total_count)
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            setOffset(0)
            updateList(filter, 0)
            if (listRef.current) listRef.current.scrollTop = 0;
        }, 300)
        return () => clearTimeout(timer)
    }, [filter])

    const handleNextPage = () => {
        const newOffset = offset + PAGE_SIZE
        if (newOffset < totalMatchingRecords) {
            setOffset(newOffset)
            updateList(filter, newOffset)
            if (listRef.current) listRef.current.scrollTop = 0;
        }
    }

    const handlePrevPage = () => {
        const newOffset = Math.max(0, offset - PAGE_SIZE)
        if (newOffset !== offset) {
            setOffset(newOffset)
            updateList(filter, newOffset)
            if (listRef.current) listRef.current.scrollTop = 0;
        }
    }

    const handleRecordClick = (index: number) => {
        setSelectedRecordIndex(index)
        setRecordDetail(parser.get_record_detail(index))
        setHeapDumpOffset(0)
        try {
            const summary = parser.get_heap_dump_summary(index)
            setHeapDumpSummary(summary)
            const subRecords = parser.get_heap_dump_records(index, 0, SUB_RECORD_PAGE_SIZE)
            setHeapDumpRecords(subRecords)
        } catch (e) {
            setHeapDumpSummary([])
            setHeapDumpRecords([])
        }
    }

    const loadMoreSubRecords = () => {
        if (selectedRecordIndex === null) return
        const newOffset = heapDumpOffset + SUB_RECORD_PAGE_SIZE
        try {
            const moreSubRecords = parser.get_heap_dump_records(selectedRecordIndex, newOffset, SUB_RECORD_PAGE_SIZE)
            if (moreSubRecords.length > 0) {
                setHeapDumpRecords(prev => [...prev, ...moreSubRecords])
                setHeapDumpOffset(newOffset)
            }
        } catch (e) {
            console.error("Failed to load more sub-records", e)
        }
    }

    const totalSubRecords = useMemo(() => {
        return heapDumpSummary.reduce((acc, entry) => acc + entry.count, 0)
    }, [heapDumpSummary])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: 'sans-serif' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #ccc', background: '#f5f5f5' }}>
                <h2 style={{ margin: '0 0 10px 0' }}>HPROF Viewer: {fileName}</h2>
                {header && (
                    <div style={{ fontSize: '0.9em', color: '#666' }}>
                        Format: {header.label} | ID Size: {header.id_size} bytes |
                        Timestamp: {new Date(Number(header.timestamp_millis)).toLocaleString()}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Records List */}
                <div style={{ width: '300px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #ccc' }}>
                    <div style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                        <input
                            type="text"
                            placeholder="Filter records..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                        <div style={{ fontSize: '0.8em', marginTop: '8px', display: 'flex', justifyContent: 'space-between', color: '#888' }}>
                            <span>{totalMatchingRecords.toLocaleString()} matches</span>
                            <span>{offset + 1}-{Math.min(offset + PAGE_SIZE, totalMatchingRecords)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                            <button
                                onClick={handlePrevPage}
                                disabled={offset === 0}
                                style={{ flex: 1, padding: '5px', cursor: offset === 0 ? 'default' : 'pointer' }}
                            >
                                Previous
                            </button>
                            <button
                                onClick={handleNextPage}
                                disabled={offset + PAGE_SIZE >= totalMatchingRecords}
                                style={{ flex: 1, padding: '5px', cursor: offset + PAGE_SIZE >= totalMatchingRecords ? 'default' : 'pointer' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                    <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }}>
                        {records.map(record => (
                            <div
                                key={record.index}
                                onClick={() => handleRecordClick(record.index)}
                                className="record-item"
                                data-tag={record.tag}
                                style={{
                                    padding: '10px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #eee',
                                    background: selectedRecordIndex === record.index ? '#e3f2fd' : 'transparent',
                                    fontSize: '0.9em'
                                }}
                            >
                                <div style={{ fontWeight: 'bold' }}>{record.tag}</div>
                                <div style={{ fontSize: '0.8em', color: '#666' }}>
                                    Index: {record.index} | Time: +{record.micros_since_header_ts}µs
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Record Detail */}
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#fff' }}>
                    {selectedRecordIndex !== null ? (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ margin: 0 }}>Record Details (Index {selectedRecordIndex})</h3>
                                <div style={{ fontSize: '0.9em', color: '#888' }}>Record ID: {selectedRecordIndex}</div>
                            </div>

                            {heapDumpSummary.length > 0 && (
                                <div id="heap-dump-summary" style={{ marginBottom: '20px', padding: '15px', background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '4px' }}>
                                    <h4 style={{ margin: '0 0 10px 0' }}>Heap Dump Summary</h4>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #eee' }}>
                                                <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
                                                <th style={{ textAlign: 'right', padding: '8px' }}>Count</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {heapDumpSummary.map((entry) => (
                                                <tr key={entry.tag} className="summary-row" style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '8px' }}>{entry.tag}</td>
                                                    <td style={{ textAlign: 'right', padding: '8px' }}>{entry.count.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {heapDumpRecords.length > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Sub-records (showing {heapDumpRecords.length} of {totalSubRecords.toLocaleString()})</span>
                                    </h4>
                                    <div style={{ border: '1px solid #ddd', borderRadius: '4px' }}>
                                        {heapDumpRecords.map((r, i) => (
                                            <pre key={i} style={{
                                                fontSize: '0.85em',
                                                background: i % 2 === 0 ? '#fff' : '#fcfcfc',
                                                padding: '12px',
                                                borderBottom: i === heapDumpRecords.length - 1 ? 'none' : '1px solid #eee',
                                                margin: 0,
                                                whiteSpace: 'pre-wrap',
                                                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'
                                            }}>
                                                {r}
                                            </pre>
                                        ))}
                                    </div>
                                    {heapDumpRecords.length < totalSubRecords && (
                                        <button
                                            onClick={loadMoreSubRecords}
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                marginTop: '10px',
                                                cursor: 'pointer',
                                                background: '#f5f5f5',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            Load More Sub-records
                                        </button>
                                    )}
                                </div>
                            )}

                            {!heapDumpSummary.length && (
                                <pre id="detail-pre" style={{
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    background: '#f8f8f8',
                                    padding: '15px',
                                    borderRadius: '4px',
                                    border: '1px solid #eee',
                                    fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                                    fontSize: '0.9em',
                                    lineHeight: '1.4'
                                }}>
                                    {recordDetail}
                                </pre>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                            Select a record to see details
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
