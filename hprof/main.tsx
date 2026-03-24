import { createRoot } from 'react-dom/client'
import init, { HprofParser, HprofHeader, RecordInfo, InstanceCountEntry } from './hprof-wasm/pkg'
import React, { ReactElement, useState, useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3';
import { graphviz } from 'd3-graphviz';

const rootElement = document.getElementById('output')
if (!rootElement) throw new Error("Root element #output not found");
const root = createRoot(rootElement)

function App() {
    const [parser, setParser] = useState<HprofParser | null>(null)
    const [fileName, setFileName] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                setLoading(true)
                setError(null)
                try {
                    await init()
                    const file = e.data.file as File
                    const bytes = new Uint8Array(await file.arrayBuffer())
                    const p = new HprofParser(bytes)
                    setParser(p)
                    setFileName(file.name)
                } catch (err) {
                    console.error("Failed to handle file:", err)
                    setError(err instanceof Error ? err.message : String(err))
                } finally {
                    setLoading(false)
                }
            }
        }

        window.addEventListener('message', handleMessage)

        if (window.parent) {
            window.parent.postMessage({ 'action': 'requestFile' }, '*')
        }

        // For testing without the main app
        if (window.location.search.includes('test=true')) {
            setLoading(true)
            fetch('test.hprof')
                .then(r => {
                    if (!r.ok) throw new Error("test.hprof not found")
                    return r.arrayBuffer()
                })
                .then(async buf => {
                    await init()
                    const p = new HprofParser(new Uint8Array(buf))
                    setParser(p)
                    setFileName('test.hprof')
                })
                .catch(e => {
                    console.error("Test load failed", e)
                    setError("Test load failed: " + e.message)
                })
                .finally(() => setLoading(false))
        }

        return () => window.removeEventListener('message', handleMessage)
    }, [])

    if (error) {
        return (
            <div style={{ padding: '20px', color: '#721c24', background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px', margin: '20px' }}>
                <h3 style={{ marginTop: 0 }}>Error Loading HPROF</h3>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
            </div>
        )
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#666' }}>
                <div className="spinner" style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 2s linear infinite', marginBottom: '10px' }}></div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                Parsing HPROF file...
            </div>
        )
    }

    if (!parser) {
        return (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                Waiting for file...
            </div>
        )
    }

    return <HprofViewer parser={parser} fileName={fileName} />
}

function GraphvizView({ dot }: { dot: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphvizRef = useRef<any>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        if (!graphvizRef.current) {
            graphvizRef.current = graphviz(containerRef.current, {
                useWorker: false,
                width: '100%',
                height: '100%',
                fit: true,
                zoom: true,
            });
        }

        graphvizRef.current
            .renderDot(dot)
            .on('end', () => {
                const svg = d3.select(containerRef.current).select('svg');
                if (svg.empty()) return;

                const zoom = graphvizRef.current.zoomBehavior();
                if (!zoom) return;

                // Intercept the wheel event to distinguish between pan and zoom
                const originalWheel = svg.on('wheel.zoom');
                svg.on('wheel.zoom', (event: WheelEvent) => {
                    if (event.ctrlKey || event.metaKey) {
                        // Zoom behavior: call the original d3-zoom wheel handler
                        if (originalWheel) {
                            originalWheel.call(svg.node() as any, event);
                        }
                    } else {
                        // Pan behavior
                        event.preventDefault();
                        event.stopImmediatePropagation();

                        const currentTransform = d3.zoomTransform(svg.node() as any);
                        const newTransform = currentTransform.translate(-event.deltaX / currentTransform.k, -event.deltaY / currentTransform.k);
                        svg.call(zoom.transform, newTransform);
                    }
                }, { passive: false });
            });
    }, [dot]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

root.render(<App />)

interface HeapSummaryEntry {
    tag: string;
    count: number;
}

const PAGE_SIZE = 100;
const SUB_RECORD_PAGE_SIZE = 50;

function HprofViewer({ parser, fileName }: { parser: HprofParser, fileName: string }): ReactElement {
    const [header, setHeader] = useState<HprofHeader | null>(null)
    const [activeTab, setActiveTab] = useState<'records' | 'instances' | 'graph' | 'hierarchy' | 'all-instances'>('records')

    // Records state
    const [records, setRecords] = useState<RecordInfo[]>([])
    const [totalMatchingRecords, setTotalMatchingRecords] = useState(0)
    const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null)
    const [recordDetail, setRecordDetail] = useState<string | null>(null)
    const [heapDumpSummary, setHeapDumpSummary] = useState<HeapSummaryEntry[]>([])
    const [heapDumpRecords, setHeapDumpRecords] = useState<string[]>([])
    const [heapDumpOffset, setHeapDumpOffset] = useState(0)
    const [filter, setFilter] = useState('')
    const [offset, setOffset] = useState(0)

    // Instance counts state
    const [instanceCounts, setInstanceCounts] = useState<InstanceCountEntry[]>([])
    const [instancesLoading, setInstancesLoading] = useState(false)

    // Graph state
    const [dot, setDot] = useState<string | null>(null)
    const [graphLoading, setGraphLoading] = useState(false)
    const [minEdgeCount, setMinEdgeCount] = useState(0)

    // Hierarchy state
    const [hierarchyDot, setHierarchyDot] = useState<string | null>(null)
    const [hierarchyLoading, setHierarchyLoading] = useState(false)

    // All instances state
    const [allInstances, setAllInstances] = useState<string[]>([])
    const [allInstancesLoading, setAllInstancesLoading] = useState(false)

    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            setHeader(parser.get_header())
            updateList('', 0)
        } catch (e) {
            console.error("Failed to load HPROF header/initial list", e)
        }
    }, [parser])

    const updateList = (query: string, newOffset: number) => {
        try {
            const result = parser.search_records(query, newOffset, PAGE_SIZE)
            setRecords(result.records)
            setTotalMatchingRecords(result.total_count)
        } catch (e) {
            console.error("Search failed", e)
        }
    }

    useEffect(() => {
        if (activeTab !== 'records') return;
        const timer = setTimeout(() => {
            setOffset(0)
            updateList(filter, 0)
            if (listRef.current) listRef.current.scrollTop = 0;
        }, 300)
        return () => clearTimeout(timer)
    }, [filter, activeTab])

    useEffect(() => {
        if (activeTab === 'instances' && instanceCounts.length === 0) {
            setInstancesLoading(true)
            setTimeout(() => {
                try {
                    const counts = parser.get_instance_counts()
                    setInstanceCounts(counts)
                } catch (e) {
                    console.error("Failed to get instance counts", e)
                } finally {
                    setInstancesLoading(false)
                }
            }, 0)
        }
    }, [activeTab, instanceCounts.length, parser])

    useEffect(() => {
        if (activeTab === 'graph') {
            setGraphLoading(true)
            setTimeout(() => {
                try {
                    const d = parser.get_class_reference_graph(minEdgeCount)
                    setDot(d)
                } catch (e) {
                    console.error("Failed to get reference graph", e)
                } finally {
                    setGraphLoading(false)
                }
            }, 0)
        }
    }, [activeTab, minEdgeCount, parser])

    useEffect(() => {
        if (activeTab === 'hierarchy' && !hierarchyDot) {
            setHierarchyLoading(true)
            setTimeout(() => {
                try {
                    const d = parser.get_class_hierarchy()
                    setHierarchyDot(d)
                } catch (e) {
                    console.error("Failed to get class hierarchy", e)
                } finally {
                    setHierarchyLoading(false)
                }
            }, 0)
        }
    }, [activeTab, hierarchyDot, parser])

    useEffect(() => {
        if (activeTab === 'all-instances' && allInstances.length === 0) {
            setAllInstancesLoading(true)
            setTimeout(() => {
                try {
                    const instances = parser.get_all_instances(1000)
                    setAllInstances(instances)
                } catch (e) {
                    console.error("Failed to get all instances", e)
                } finally {
                    setAllInstancesLoading(false)
                }
            }, 0)
        }
    }, [activeTab, allInstances.length, parser])

    const handleRecordClick = (index: number) => {
        setSelectedRecordIndex(index)
        try {
            setRecordDetail(parser.get_record_detail(index))
            setHeapDumpOffset(0)
            const summary = parser.get_heap_dump_summary(index)
            setHeapDumpSummary(summary)
            const subRecords = parser.get_heap_dump_records(index, 0, SUB_RECORD_PAGE_SIZE)
            setHeapDumpRecords(subRecords)
        } catch (e) {
            console.error("Failed to load record details", e)
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

    const tabStyle = (tab: string) => ({
        padding: '10px 20px',
        cursor: 'pointer',
        borderBottom: activeTab === tab ? '2px solid #007bff' : 'none',
        color: activeTab === tab ? '#007bff' : '#666',
        fontWeight: activeTab === tab ? 'bold' : 'normal',
    } as const);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: 'sans-serif' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #ccc', background: '#f5f5f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0 }}>HPROF Viewer: {fileName}</h2>
                    {header && (
                        <div style={{ fontSize: '0.9em', color: '#666' }}>
                            Format: {header.label} | ID Size: {header.id_size} bytes |
                            Timestamp: {new Date(Number(header.timestamp_millis)).toLocaleString()}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', marginTop: '10px', borderBottom: '1px solid #ddd' }}>
                    <div style={tabStyle('records')} onClick={() => setActiveTab('records')}>Records</div>
                    <div style={tabStyle('instances')} onClick={() => setActiveTab('instances')}>Instance Counts</div>
                    <div style={tabStyle('graph')} onClick={() => setActiveTab('graph')}>Reference Graph</div>
                    <div style={tabStyle('hierarchy')} onClick={() => setActiveTab('hierarchy')}>Hierarchy</div>
                    <div style={tabStyle('all-instances')} onClick={() => setActiveTab('all-instances')}>All Objects</div>
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {activeTab === 'records' && (
                    <>
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
                                        onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); updateList(filter, Math.max(0, offset - PAGE_SIZE)); }}
                                        disabled={offset === 0}
                                        style={{ flex: 1, padding: '5px' }}
                                    >Prev</button>
                                    <button
                                        onClick={() => { setOffset(offset + PAGE_SIZE); updateList(filter, offset + PAGE_SIZE); }}
                                        disabled={offset + PAGE_SIZE >= totalMatchingRecords}
                                        style={{ flex: 1, padding: '5px' }}
                                    >Next</button>
                                </div>
                            </div>
                            <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }}>
                                {records.map(record => (
                                    <div
                                        key={record.index}
                                        onClick={() => handleRecordClick(record.index)}
                                        className="record-item"
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
                                    <h3 style={{ marginBottom: '15px' }}>Record Details (Index {selectedRecordIndex})</h3>

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
                                                        <tr key={entry.tag} style={{ borderBottom: '1px solid #eee' }}>
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
                                                        fontFamily: 'monospace'
                                                    }}>{r}</pre>
                                                ))}
                                            </div>
                                            {heapDumpRecords.length < totalSubRecords && (
                                                <button onClick={loadMoreSubRecords} style={{ width: '100%', padding: '10px', marginTop: '10px', cursor: 'pointer' }}>Load More</button>
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
                                            fontFamily: 'monospace'
                                        }}>{recordDetail}</pre>
                                    )}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Select a record to see details</div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'instances' && (
                    <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                        <h3>Instance Counts</h3>
                        {instancesLoading ? (
                            <div style={{ padding: '20px', color: '#666' }}>Analyzing heap dump... this might take a moment.</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                                <thead style={{ background: '#f5f5f5', position: 'sticky', top: 0 }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd' }}>Class Name</th>
                                        <th style={{ textAlign: 'right', padding: '10px', borderBottom: '2px solid #ddd' }}>Count</th>
                                        <th style={{ textAlign: 'right', padding: '10px', borderBottom: '2px solid #ddd' }}>Total Size</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {instanceCounts.map((entry, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '10px' }}>{entry.class_name}</td>
                                            <td style={{ textAlign: 'right', padding: '10px' }}>{entry.count.toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', padding: '10px' }}>{entry.total_size.toLocaleString()} bytes</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'graph' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '10px 20px', borderBottom: '1px solid #eee', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Reference Graph</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ fontSize: '0.85em', color: '#666' }}>
                                    Min Edge Count:
                                    <input
                                        type="number"
                                        value={minEdgeCount}
                                        onChange={(e) => setMinEdgeCount(Math.max(0, parseInt(e.target.value) || 0))}
                                        style={{ marginLeft: '5px', width: '50px', padding: '2px 5px' }}
                                    />
                                </div>
                                <div style={{ fontSize: '0.85em', color: '#888' }}>Top 20+ classes by instance count</div>
                            </div>
                        </div>
                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                            {graphLoading ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Building graph structure...</div>
                            ) : dot ? (
                                <GraphvizView dot={dot} />
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Failed to generate graph.</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'hierarchy' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '10px 20px', borderBottom: '1px solid #eee', background: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0 }}>Class Hierarchy</h3>
                        </div>
                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                            {hierarchyLoading ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Building hierarchy...</div>
                            ) : hierarchyDot ? (
                                <GraphvizView dot={hierarchyDot} />
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Failed to generate hierarchy.</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'all-instances' && (
                    <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                        <h3>All Objects (Limit 1000)</h3>
                        {allInstancesLoading ? (
                            <div style={{ padding: '20px', color: '#666' }}>Extracting objects...</div>
                        ) : (
                            <div style={{ border: '1px solid #ddd', borderRadius: '4px' }}>
                                {allInstances.map((instance, idx) => (
                                    <pre key={idx} style={{
                                        fontSize: '0.85em',
                                        background: idx % 2 === 0 ? '#fff' : '#fcfcfc',
                                        padding: '12px',
                                        borderBottom: idx === allInstances.length - 1 ? 'none' : '1px solid #eee',
                                        margin: 0,
                                        whiteSpace: 'pre-wrap',
                                        fontFamily: 'monospace'
                                    }}>{instance}</pre>
                                ))}
                                {allInstances.length === 0 && <div style={{ padding: '20px', color: '#999' }}>No instances found.</div>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
