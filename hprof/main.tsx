import { createRoot } from 'react-dom/client'
import init, { HprofParser, HprofHeader, RecordInfo, InstanceCountEntry } from './hprof-wasm/pkg'
import React, { ReactElement, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import * as d3 from 'd3';
import { graphviz } from 'd3-graphviz';

interface HierarchyNode extends d3.SimulationNodeDatum {
    id: string;
    name: string;
    size?: number;
}

interface HierarchyLink extends d3.SimulationLinkDatum<HierarchyNode> {
    source: string | HierarchyNode;
    target: string | HierarchyNode;
    count?: number;
}

interface HierarchyData {
    nodes: HierarchyNode[];
    links: HierarchyLink[];
}

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

interface ExtendedHierarchyNode extends HierarchyNode {
    fontSize: number;
    width: number;
    height: number;
}

function ForceGraph({ data }: { data: HierarchyData }) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedNode, setSelectedNode] = useState<ExtendedHierarchyNode | null>(null);

    const maxCount = useMemo(() => {
        return Math.max(...data.links.map(l => (l.count as number) || 0), 1);
    }, [data.links]);

    const maxSize = useMemo(() => {
        return Math.max(...data.nodes.map(n => n.size || 0), 1);
    }, [data.nodes]);

    useEffect(() => {
        if (!svgRef.current || !data.nodes.length) return;

        const width = svgRef.current.clientWidth || 800;
        const height = svgRef.current.clientHeight || 600;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const container = svg.append("g");

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 10])
            .on("zoom", (event) => {
                container.attr("transform", event.transform);
            });

        svg.call(zoom);

        // Pre-calculate node sizes for collision and rendering
        const nodeData: ExtendedHierarchyNode[] = data.nodes.map(n => {
            const scale = n.size ? Math.sqrt(n.size / maxSize) : 0;
            const fontSize = 12 + scale * 12;
            return { ...n, fontSize, width: 0, height: 0 } as ExtendedHierarchyNode;
        });

        const simulation = d3.forceSimulation<ExtendedHierarchyNode>(nodeData)
            .force("link", d3.forceLink<ExtendedHierarchyNode, HierarchyLink>(data.links).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-1000))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("x", d3.forceX(width / 2).strength(0.1))
            .force("y", d3.forceY(height / 2).strength(0.1));

        const link = container.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(data.links)
            .join("line")
            .attr("stroke-width", d => 1 + ((d.count as number) ? ((d.count as number) / maxCount * 8) : 1));

        const node = container.append("g")
            .selectAll("g")
            .data(nodeData)
            .join("g")
            .attr("cursor", "pointer")
            .on("click", (event, d) => {
                event.stopPropagation();
                setSelectedNode(d);
            })
            .call(d3.drag<SVGGElement, ExtendedHierarchyNode>()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

        node.append("rect")
            .attr("fill", "#fff")
            .attr("stroke", "#007bff")
            .attr("stroke-width", 1.5)
            .attr("rx", 4)
            .attr("ry", 4);

        node.append("text")
            .text(d => d.name)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "sans-serif")
            .style("pointer-events", "none")
            .style("font-size", d => `${d.fontSize}px`);

        // Update rect sizes based on text BBox
        node.each(function(d) {
            const textNode = d3.select(this).select("text").node() as SVGTextElement;
            const bbox = textNode.getBBox();
            const paddingX = 10;
            const paddingY = 6;
            d.width = bbox.width + paddingX;
            d.height = bbox.height + paddingY;
            d3.select(this).select("rect")
                .attr("x", -d.width / 2)
                .attr("y", -d.height / 2)
                .attr("width", d.width)
                .attr("height", d.height);
        });

        // Add collision force after we know the dimensions
        simulation.force("collide", d3.forceCollide<ExtendedHierarchyNode>().radius(d => Math.max(d.width, d.height) / 2 + 10));

        simulation.on("tick", () => {
            link
                .attr("x1", d => (d.source as unknown as ExtendedHierarchyNode).x!)
                .attr("y1", d => (d.source as unknown as ExtendedHierarchyNode).y!)
                .attr("x2", d => (d.target as unknown as ExtendedHierarchyNode).x!)
                .attr("y2", d => (d.target as unknown as ExtendedHierarchyNode).y!);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        svg.on("click", () => setSelectedNode(null));

        return () => simulation.stop();
    }, [data, maxSize, maxCount]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <svg ref={svgRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
            {selectedNode && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '15px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    border: '1px solid #ddd',
                    maxWidth: '300px',
                    zIndex: 100,
                    fontSize: '14px'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', wordBreak: 'break-all' }}>{selectedNode.name}</div>
                    <div style={{ color: '#666' }}>ID: {selectedNode.id}</div>
                    {selectedNode.size! > 0 && (
                        <div style={{ marginTop: '5px' }}>
                            Total Size: <span style={{ fontWeight: 'bold' }}>{selectedNode.size?.toLocaleString()} bytes</span>
                        </div>
                    )}
                    <button
                        onClick={() => setSelectedNode(null)}
                        style={{ marginTop: '10px', width: '100%', padding: '5px', cursor: 'pointer' }}
                    >Close</button>
                </div>
            )}
        </div>
    );
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

                // Remove maximum zoom level
                zoom.scaleExtent([0, Infinity]);

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

                        const multiplier = 20;
                        const currentTransform = d3.zoomTransform(svg.node() as any);
                        const newTransform = currentTransform.translate(
                            (-event.deltaX * multiplier) / currentTransform.k,
                            (-event.deltaY * multiplier) / currentTransform.k
                        );
                        svg.call(zoom.transform, newTransform);
                    }
                }, { passive: false });
            });
    }, [dot]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
    return (
        <div
            onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMouseDown(e);
            }}
            style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: '4px',
                cursor: 'col-resize',
                zIndex: 10,
                transition: 'background-color 0.2s',
            }}
            className="resize-handle"
        />
    );
}

function InstanceCountsView({ entries, loading }: { entries: InstanceCountEntry[], loading: boolean }) {
    const [sortConfig, setSortConfig] = useState<{ key: keyof InstanceCountEntry, direction: 'asc' | 'desc' }>({ key: 'total_size', direction: 'desc' });
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        class_name: 500,
        count: 150,
        total_size: 200,
    });

    const handleResize = useCallback((column: string) => (e: React.MouseEvent) => {
        const startX = e.pageX;
        const startWidth = columnWidths[column];

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(50, startWidth + (moveEvent.pageX - startX));
            setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [columnWidths]);

    const sortedEntries = useMemo(() => {
        const items = [...entries];
        items.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];
            let comparison = 0;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            }
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
        return items;
    }, [entries, sortConfig]);

    const handleSort = (key: keyof InstanceCountEntry) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIndicator = ({ colKey }: { colKey: keyof InstanceCountEntry }) => (
        <span style={{ marginLeft: '4px' }}>
            {sortConfig.key === colKey && (sortConfig.direction === 'asc' ? '↑' : '↓')}
        </span>
    );

    if (loading) {
        return <div style={{ padding: '20px', color: '#666' }}>Analyzing heap dump... this might take a moment.</div>;
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <style>
                {`
                    .resize-handle:hover {
                        background-color: #007bff;
                    }
                    th {
                        user-select: none;
                    }
                `}
            </style>
            <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead style={{ background: '#f5f5f5', position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd', width: columnWidths.class_name, position: 'relative', cursor: 'pointer' }} onClick={() => handleSort('class_name')}>
                                Class Name <SortIndicator colKey="class_name" />
                                <ResizeHandle onMouseDown={handleResize('class_name')} />
                            </th>
                            <th style={{ textAlign: 'right', padding: '10px', borderBottom: '2px solid #ddd', width: columnWidths.count, position: 'relative', cursor: 'pointer' }} onClick={() => handleSort('count')}>
                                Count <SortIndicator colKey="count" />
                                <ResizeHandle onMouseDown={handleResize('count')} />
                            </th>
                            <th style={{ textAlign: 'right', padding: '10px', borderBottom: '2px solid #ddd', width: columnWidths.total_size, position: 'relative', cursor: 'pointer' }} onClick={() => handleSort('total_size')}>
                                Total Size <SortIndicator colKey="total_size" />
                                <ResizeHandle onMouseDown={handleResize('total_size')} />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEntries.map((entry, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.class_name}</td>
                                <td style={{ textAlign: 'right', padding: '10px' }}>{entry.count.toLocaleString()}</td>
                                <td style={{ textAlign: 'right', padding: '10px' }}>{entry.total_size.toLocaleString()} bytes</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
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
    const [weightsInitialized, setWeightsInitialized] = useState(false)
    const [graphMode, setGraphMode] = useState<'static' | 'force'>('force')
    const [forceGraphData, setForceGraphData] = useState<HierarchyData | null>(null)

    // Hierarchy state
    const [hierarchyData, setHierarchyData] = useState<HierarchyData | null>(null)
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
        if (activeTab === 'graph' && !weightsInitialized) {
            try {
                const weights = parser.get_reference_weights();
                if (weights && weights.length > 0) {
                    const sorted = [...weights].sort((a, b) => a - b);
                    const median = sorted[Math.floor(sorted.length / 2)];
                    setMinEdgeCount(median);
                }
                setWeightsInitialized(true);
            } catch (e) {
                console.error("Failed to get weights", e);
                setWeightsInitialized(true);
            }
        }
    }, [activeTab, weightsInitialized, parser]);

    useEffect(() => {
        if (activeTab === 'graph') {
            setGraphLoading(true)
            setTimeout(() => {
                try {
                    if (graphMode === 'static') {
                        const d = parser.get_class_reference_graph(minEdgeCount)
                        setDot(d)
                    } else {
                        const d = parser.get_class_reference_graph_json(minEdgeCount)
                        setForceGraphData(d)
                    }
                } catch (e) {
                    console.error("Failed to get reference graph", e)
                } finally {
                    setGraphLoading(false)
                }
            }, 0)
        }
    }, [activeTab, minEdgeCount, graphMode, parser])

    useEffect(() => {
        if (activeTab === 'hierarchy' && !hierarchyData) {
            setHierarchyLoading(true)
            setTimeout(() => {
                try {
                    const d = parser.get_class_hierarchy_json()
                    setHierarchyData(d)
                } catch (e) {
                    console.error("Failed to get class hierarchy", e)
                } finally {
                    setHierarchyLoading(false)
                }
            }, 0)
        }
    }, [activeTab, hierarchyData, parser])

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
            setHeapDumpSummary([])
            setHeapDumpRecords([])
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
                    <InstanceCountsView entries={instanceCounts} loading={instancesLoading} />
                )}

                {activeTab === 'graph' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '10px 20px', borderBottom: '1px solid #eee', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Reference Graph</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ fontSize: '0.85em', color: '#666' }}>
                                    Mode:
                                    <select
                                        value={graphMode}
                                        onChange={(e) => setGraphMode(e.target.value as any)}
                                        style={{ marginLeft: '5px', padding: '2px 5px' }}
                                    >
                                        <option value="static">Static</option>
                                        <option value="force">Force</option>
                                    </select>
                                </div>
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
                            ) : (graphMode === 'static' ? (
                                dot ? <GraphvizView dot={dot} /> : <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Failed to generate graph.</div>
                            ) : (
                                forceGraphData ? <ForceGraph data={forceGraphData} /> : <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Failed to generate graph.</div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'hierarchy' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '10px 20px', borderBottom: '1px solid #eee', background: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0 }}>Class Hierarchy</h3>
                            <div style={{ fontSize: '0.85em', color: '#888' }}>Skipping java.lang.Object</div>
                        </div>
                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                            {hierarchyLoading ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Building hierarchy...</div>
                            ) : hierarchyData ? (
                                <ForceGraph data={hierarchyData} />
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
