import { createRoot } from 'react-dom/client'
import init, { HprofParser, HprofHeader, RecordInfo, InstanceCountEntry, HierarchyData, InstanceInfo, SankeyData } from './hprof-wasm/pkg'
import React, { ReactElement, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { MantineProvider, Tabs, Box, LoadingOverlay, Text, Button, Table, Group, Stack } from '@mantine/core'
import '@mantine/core/styles.css'

import { RecordsView } from './src/components/RecordsView'
import { InstanceCountsView } from './src/components/InstanceCountsView'
import { ReferenceGraphView } from './src/components/ReferenceGraphView'
import { SankeyView } from './src/components/SankeyView'
import { AllObjectsView } from './src/components/AllObjectsView'
import { GraphvizView } from './src/components/GraphvizView'
import { ClassInstancesView } from './src/components/ClassInstancesView'
import { InstanceDetailView } from './src/components/InstanceDetailView'

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

    return (
        <MantineProvider defaultColorScheme="light">
            {loading ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#666' }}>
                    <LoadingOverlay visible={true} />
                    Parsing HPROF file...
                </div>
            ) : !parser ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                    Waiting for file...
                </div>
            ) : (
                <HprofViewer parser={parser} fileName={fileName} />
            )}
        </MantineProvider>
    )
}

function HprofViewer({ parser, fileName }: { parser: HprofParser, fileName: string }): ReactElement {
    const [header, setHeader] = useState<HprofHeader | null>(null)
    const [activeTab, setActiveTab] = useState<string | null>('records')

    // Records state
    const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null)
    const [recordDetail, setRecordDetail] = useState<string | null>(null)
    const [heapDumpSummary, setHeapDumpSummary] = useState<any[]>([])
    const [heapDumpRecords, setHeapDumpRecords] = useState<string[]>([])
    const [heapDumpOffset, setHeapDumpOffset] = useState(0)
    const SUB_RECORD_PAGE_SIZE = 50

    // Instance counts state
    const [instanceCounts, setInstanceCounts] = useState<InstanceCountEntry[]>([])
    const [instancesLoading, setInstancesLoading] = useState(false)
    const [selectedClass, setSelectedClass] = useState<{ id: string, name: string } | null>(null);
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

    // Graph state
    const [dot, setDot] = useState<string | null>(null)
    const [graphLoading, setGraphLoading] = useState(false)
    const [minEdgeCount, setMinEdgeCount] = useState(0)
    const [weightsInitialized, setWeightsInitialized] = useState(false)
    const [graphMode, setGraphMode] = useState<'static' | 'force'>('force')
    const [forceGraphData, setForceGraphData] = useState<HierarchyData | null>(null)

    // All instances state
    const [allInstances, setAllInstances] = useState<string[]>([])
    const [allInstancesLoading, setAllInstancesLoading] = useState(false)

    // Sankey state
    const [sankeyData, setSankeyData] = useState<SankeyData | null>(null);
    const [sankeyLoading, setSankeyLoading] = useState(false);

    useEffect(() => {
        try {
            setHeader(parser.get_header())
        } catch (e) {
            console.error("Failed to load HPROF header", e)
        }
    }, [parser])

    useEffect(() => {
        if (activeTab === 'instances' && instanceCounts.length === 0) {
            setInstancesLoading(true)
            setTimeout(() => {
                try {
                    setInstanceCounts(parser.get_instance_counts())
                } catch (e) { console.error(e) }
                finally { setInstancesLoading(false) }
            }, 0)
        }
    }, [activeTab, parser])

    useEffect(() => {
        if (activeTab === 'graph' && !weightsInitialized) {
            try {
                const weights = parser.get_reference_weights();
                if (weights && weights.length > 0) {
                    const sorted = [...weights].sort((a, b) => a - b);
                    setMinEdgeCount(sorted[Math.floor(sorted.length / 2)]);
                }
                setWeightsInitialized(true);
            } catch (e) { console.error(e); setWeightsInitialized(true); }
        }
    }, [activeTab, parser]);

    useEffect(() => {
        if (activeTab === 'graph') {
            setGraphLoading(true)
            setTimeout(() => {
                try {
                    if (graphMode === 'static') setDot(parser.get_class_reference_graph(minEdgeCount))
                    else setForceGraphData(parser.get_class_reference_graph_json(minEdgeCount))
                } catch (e) { console.error(e) }
                finally { setGraphLoading(false) }
            }, 0)
        }
    }, [activeTab, minEdgeCount, graphMode, parser])

    useEffect(() => {
        if (activeTab === 'all-objects' && allInstances.length === 0) {
            setAllInstancesLoading(true)
            setTimeout(() => {
                try { setAllInstances(parser.get_all_instances(1000)) }
                catch (e) { console.error(e) }
                finally { setAllInstancesLoading(false) }
            }, 0)
        }
    }, [activeTab, parser])

    useEffect(() => {
        if (activeTab === 'sankey' && !sankeyData) {
            setSankeyLoading(true);
            setTimeout(() => {
                try { setSankeyData(parser.get_sankey_data()) }
                catch (e) { console.error(e) }
                finally { setSankeyLoading(false) }
            }, 0);
        }
    }, [activeTab, parser]);

    const handleRecordClick = (index: number) => {
        setSelectedRecordIndex(index)
        try {
            setRecordDetail(parser.get_record_detail(index))
            setHeapDumpOffset(0)
            setHeapDumpSummary(parser.get_heap_dump_summary(index))
            setHeapDumpRecords(parser.get_heap_dump_records(index, 0, SUB_RECORD_PAGE_SIZE))
        } catch (e) {
            console.error(e)
            setHeapDumpSummary([])
            setHeapDumpRecords([])
        }
    }

    const loadMoreSubRecords = () => {
        if (selectedRecordIndex === null) return
        const newOffset = heapDumpOffset + SUB_RECORD_PAGE_SIZE
        try {
            const more = parser.get_heap_dump_records(selectedRecordIndex, newOffset, SUB_RECORD_PAGE_SIZE)
            if (more.length > 0) {
                setHeapDumpRecords(prev => [...prev, ...more])
                setHeapDumpOffset(newOffset)
            }
        } catch (e) { console.error(e) }
    }

    const handleSelectClass = (id: string, name: string) => {
        setSelectedClass({ id, name });
        setSelectedInstanceId(null);
    };

    const handleSelectInstance = (id: string) => {
        setSelectedInstanceId(id);
        setActiveTab('instances');
    };

    return (
        <Stack h="100vh" gap={0}>
            <Box p="md" bg="gray.0" style={{ borderBottom: '1px solid #ccc' }}>
                <Group justify="space-between">
                    <Text component="h2" size="xl" fw={700} style={{ margin: 0 }}>HPROF Viewer: {fileName}</Text>
                    {header && (
                        <Text size="xs" c="dimmed">
                            Format: {header.label} | ID Size: {header.id_size} bytes |
                            Timestamp: {new Date(Number(header.timestamp_millis)).toLocaleString()}
                        </Text>
                    )}
                </Group>
            </Box>

            <Tabs value={activeTab} onChange={setActiveTab} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Tabs.List>
                    <Tabs.Tab value="records">Records</Tabs.Tab>
                    <Tabs.Tab value="instances">Instance Counts</Tabs.Tab>
                    <Tabs.Tab value="graph">Reference Graph</Tabs.Tab>
                    <Tabs.Tab value="sankey">Memory Flow (Sankey)</Tabs.Tab>
                    <Tabs.Tab value="all-objects">All Objects</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="records" style={{ flex: 1, overflow: 'hidden' }}>
                    <Group h="100%" gap={0} align="stretch" wrap="nowrap">
                        <Box w={500} h="100%" style={{ borderRight: '1px solid #ccc', overflowY: 'auto' }}>
                            <RecordsView parser={parser} onRecordClick={handleRecordClick} selectedRecordIndex={selectedRecordIndex} />
                        </Box>
                        <Box style={{ flex: 1, overflowY: 'auto' }} p="md">
                            {selectedRecordIndex !== null ? (
                                <Stack>
                                    <Text size="lg" fw={700}>Record Details (Index {selectedRecordIndex})</Text>
                                    {heapDumpSummary.length > 0 && (
                                        <Box p="md" bg="gray.0" style={{ border: '1px solid #ddd', borderRadius: '4px' }}>
                                            <Text fw={700} mb="xs">Heap Dump Summary</Text>
                                            <Table>
                                                <Table.Thead>
                                                    <Table.Tr><Table.Th>Type</Table.Th><Table.Th style={{ textAlign: 'right' }}>Count</Table.Th></Table.Tr>
                                                </Table.Thead>
                                                <Table.Tbody>
                                                    {heapDumpSummary.map((entry) => (
                                                        <Table.Tr key={entry.tag}>
                                                            <Table.Td>{entry.tag}</Table.Td>
                                                            <Table.Td style={{ textAlign: 'right' }}>{entry.count.toLocaleString()}</Table.Td>
                                                        </Table.Tr>
                                                    ))}
                                                </Table.Tbody>
                                            </Table>
                                        </Box>
                                    )}
                                    {heapDumpRecords.length > 0 && (
                                        <Stack>
                                            <Text fw={700}>Sub-records (showing {heapDumpRecords.length})</Text>
                                            {heapDumpRecords.map((r, i) => (
                                                <pre key={i} style={{ fontSize: '0.85em', background: '#f8f8f8', padding: '8px', margin: 0, whiteSpace: 'pre-wrap' }}>{r}</pre>
                                            ))}
                                            <Button onClick={loadMoreSubRecords} variant="light">Load More</Button>
                                        </Stack>
                                    )}
                                    {!heapDumpSummary.length && <pre style={{ whiteSpace: 'pre-wrap', background: '#f8f8f8', padding: '10px' }}>{recordDetail}</pre>}
                                </Stack>
                            ) : <Text c="dimmed" ta="center" mt="xl">Select a record to see details</Text>}
                        </Box>
                    </Group>
                </Tabs.Panel>

                <Tabs.Panel value="instances" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {selectedInstanceId ? (
                        <InstanceDetailView parser={parser} instanceId={selectedInstanceId} onBack={() => setSelectedInstanceId(null)} onSelectInstance={handleSelectInstance} />
                    ) : selectedClass ? (
                        <ClassInstancesView parser={parser} classId={selectedClass.id} className={selectedClass.name} onBack={() => setSelectedClass(null)} onSelectInstance={handleSelectInstance} />
                    ) : (
                        <InstanceCountsView entries={instanceCounts} loading={instancesLoading} onSelectClass={handleSelectClass} />
                    )}
                </Tabs.Panel>

                <Tabs.Panel value="graph" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Stack h="100%" gap={0}>
                        <Group p="xs" justify="space-between" bg="gray.0" style={{ borderBottom: '1px solid #eee' }}>
                            <Text fw={700}>Reference Graph</Text>
                            <Group>
                                <Text size="sm">Mode:</Text>
                                <select value={graphMode} onChange={(e) => setGraphMode(e.target.value as any)}>
                                    <option value="static">Static</option>
                                    <option value="force">Force</option>
                                </select>
                                <Text size="sm">Min Edge Count:</Text>
                                <input type="number" value={minEdgeCount} onChange={(e) => setMinEdgeCount(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: '60px' }} />
                            </Group>
                        </Group>
                        <Box style={{ flex: 1, position: 'relative' }}>
                            <LoadingOverlay visible={graphLoading} />
                            {graphMode === 'static' ? (dot && <GraphvizView dot={dot} />) : (forceGraphData && <ReferenceGraphView data={forceGraphData} onSelectNode={handleSelectClass} />)}
                        </Box>
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="sankey" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Stack h="100%" gap={0}>
                        <Box p="xs" bg="gray.0" style={{ borderBottom: '1px solid #eee' }}>
                            <Text fw={700}>Memory Flow (Top Classes)</Text>
                        </Box>
                        <Box style={{ flex: 1, position: 'relative' }}>
                            <LoadingOverlay visible={sankeyLoading} />
                            {sankeyData && <SankeyView data={sankeyData} />}
                        </Box>
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="all-objects" style={{ flex: 1 }}>
                    <AllObjectsView allInstances={allInstances} loading={allInstancesLoading} />
                </Tabs.Panel>
            </Tabs>
        </Stack>
    )
}

root.render(<App />)
