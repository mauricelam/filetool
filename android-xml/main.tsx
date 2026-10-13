import { createRoot } from 'react-dom/client'
import init, { ArscResource, extract_arsc, decode_xml } from './wasm/pkg'
import React, { useState, useEffect, useRef } from 'react'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'
import 'react-tabs/style/react-tabs.css'

const OUTPUT = createRoot(document.getElementById('output')!);
let wasmInitialized = false;
let systemResources: Uint8Array | null = null;

const initializeWasm = async () => {
    if (!wasmInitialized) {
        try {
            await init();

            // Load system resources
            const response = await fetch('android.arsc.gz');
            if (!response.ok) throw new Error('Failed to fetch android.arsc.gz');

            // Decompress using DecompressionStream
            const ds = new DecompressionStream('gzip');
            const decompressedStream = response.body!.pipeThrough(ds);
            systemResources = new Uint8Array(await new Response(decompressedStream).arrayBuffer());

            wasmInitialized = true;
        } catch (error) {
            console.error('Failed to initialize WebAssembly:', error);
            throw error;
        }
    }
};

function App() {
    const [view, setView] = useState<'resource' | 'xml' | 'loading'>('loading');
    const [resources, setResources] = useState<ArscResource[]>([]);
    const [xmlContent, setXmlContent] = useState<string>('');
    const [filename, setFilename] = useState<string>('AndroidManifest.xml');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Request file from parent window
        if (window.parent) {
            window.parent.postMessage({ 'action': 'requestFile' });
        }

        // Set up message handler
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                try {
                    await handleFile(e.data.file);
                } catch (error) {
                    console.error('Error handling file:', error);
                    setError((error as Error).message);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleFile = async (file: File) => {
        if (!wasmInitialized) {
            await initializeWasm();
        }
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        setFilename(file.name);

        if (!systemResources) throw new Error("System resources not loaded");

        // Try standalone ARSC
        if (file.name.endsWith('.arsc')) {
            try {
                const resources = extract_arsc(fileBytes, systemResources);
                setResources(resources);
                setView('resource');
                return;
            } catch (e) {
                console.log("Failed to decode as standalone ARSC", e);
            }
        }

        // Try standalone XML
        try {
            const xml = decode_xml(fileBytes, systemResources);
            setXmlContent(xml);
            setView('xml');
        } catch (e) {
            console.log("Failed to decode as standalone XML", e);
            // If it failed and we haven't tried ARSC yet
            if (!file.name.endsWith('.arsc')) {
                try {
                    const resources = extract_arsc(fileBytes, systemResources);
                    setResources(resources);
                    setView('resource');
                    return;
                } catch (arscError) {
                    console.log("Also failed to decode as standalone ARSC", arscError);
                }
            }
            setError("Failed to decode file as Android Binary XML or ARSC");
        }
    }

    if (error) {
        return <div style={{ color: 'red', padding: '10px' }}>Error: {error}</div>;
    }

    if (view === 'loading') {
        return <div style={{ padding: '20px' }}>Loading...</div>;
    }

    if (view === 'resource') {
        return <ResourceTableViewer resources={resources} />;
    }

    return <XmlViewer content={xmlContent} filename={filename} />;
}

function XmlViewer({ content, filename }: { content: string, filename: string }) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const handleIframeLoad = () => {
        if (iframeRef.current) {
            const file = new File([content], filename, { type: 'text/xml' });
            iframeRef.current.contentWindow?.postMessage({
                action: 'respondFile',
                file: file,
            }, '*');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
                <iframe
                    ref={iframeRef}
                    src="../textviewer/index.html"
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    onLoad={handleIframeLoad}
                />
            </div>
        </div>
    );
}

function matchesFilter(r: ArscResource, filterText: string): boolean {
    if (!filterText) return true;
    const low = filterText.trim().toLowerCase();
    if (!low) return true;

    const hexId = r.entry_id.toString(16).toLowerCase();
    const hexIdWith0x = '0x' + hexId;
    const decId = r.entry_id.toString();
    if (hexId.includes(low) || hexIdWith0x.includes(low) || decId.includes(low)) {
        return true;
    }

    if (r.name.toLowerCase().includes(low)) return true;
    if (r.type_name.toLowerCase().includes(low)) return true;

    if (r.value && typeof r.value === 'string' && r.value.toLowerCase().includes(low)) return true;

    if (r.entries) {
        for (const [key, val] of Object.entries(r.entries)) {
            if (key.toLowerCase().includes(low)) return true;
            if (typeof val === 'string' && val.toLowerCase().includes(low)) return true;
        }
    }

    return false;
}

function ResourceTableViewer({ resources }: { resources: ArscResource[] }) {
    // Group resources by type name
    const resourcesByType = resources.reduce((acc, resource) => {
        const typeName = resource.type_name;
        if (!acc[typeName]) {
            acc[typeName] = [];
        }
        acc[typeName].push(resource);
        return acc;
    }, {} as Record<string, ArscResource[]>);

    const types = ['All', ...Object.keys(resourcesByType)];
    const [selectedType, setSelectedType] = useState<string>('All');
    const [filter, setFilter] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: 'entry_id' | 'name' | 'value', direction: 'asc' | 'desc' }>({
        key: 'entry_id',
        direction: 'asc'
    });

    useEffect(() => {
        if (!types.includes(selectedType) && types.length > 0) {
            setSelectedType(types[0]);
        }
    }, [types, selectedType]);

    const handleSort = (key: 'entry_id' | 'name' | 'value') => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const filteredCountsByType = React.useMemo(() => {
        const counts: Record<string, number> = { All: 0 };
        for (const r of resources) {
            if (matchesFilter(r, filter)) {
                counts.All = (counts.All || 0) + 1;
                counts[r.type_name] = (counts[r.type_name] || 0) + 1;
            }
        }
        return counts;
    }, [resources, filter]);

    function getSortedResources(): ArscResource[] {
        let items = selectedType === 'All' ? resources : (resourcesByType[selectedType] || []);
        if (filter) {
            items = items.filter(r => matchesFilter(r, filter));
        }
        return [...items].sort((a, b) => {
            let comparison = 0;
            if (sortConfig.key === 'entry_id') {
                comparison = a.entry_id - b.entry_id;
            } else if (sortConfig.key === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else {
                comparison = (a.value || '').localeCompare(b.value || '');
            }
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }

    const SortIndicator = ({ column }: { column: 'entry_id' | 'name' | 'value' }) => (
        <span style={{ marginLeft: '4px' }}>
            {sortConfig.key === column && (sortConfig.direction === 'asc' ? '↑' : '↓')}
        </span>
    );

    console.log("resourcesByType", resourcesByType)

    return (
        <div style={{
            padding: '20px',
            overflow: 'auto',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                marginBottom: '16px'
            }}>
                <h3 style={{ margin: 0 }}>Resource Table</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="Search by name, ID, or value..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            width: '280px',
                            fontSize: '14px'
                        }}
                    />
                    {filter && (
                        <button
                            onClick={() => setFilter('')}
                            style={{
                                padding: '6px 10px',
                                borderRadius: '4px',
                                border: '1px solid #ccc',
                                background: '#f0f0f0',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {types.length === 0 && <div style={{ padding: '20px' }}>No resources found in ARSC file.</div>}

            {/* Type selector tabs */}
            <div style={{ marginBottom: '16px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Tabs
                    selectedIndex={Math.max(0, types.indexOf(selectedType))}
                    onSelect={(index) => setSelectedType(types[index])}
                    style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
                >
                    <TabList>
                        {types.map(typeName => (
                            <Tab key={typeName}>
                                {typeName} ({filteredCountsByType[typeName] || 0})
                            </Tab>
                        ))}
                    </TabList>

                    {types.map(typeName => (
                        <TabPanel key={typeName} style={{ flex: 1, overflow: 'auto', marginTop: '8px' }}>
                            {/* Resource table */}
                            <div style={{
                                overflow: 'auto',
                                height: '100%',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: selectedType === 'All' ? 'auto auto auto auto' : (selectedType !== 'id' ? 'auto auto auto' : 'auto auto'),
                                    gap: '8px',
                                    padding: '8px',
                                    minWidth: 'min-content'
                                }}>
                                    <div
                                        style={{
                                            fontWeight: 'bold',
                                            padding: '8px',
                                            borderBottom: '1px solid #ccc',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onClick={() => handleSort('entry_id')}
                                    >
                                        Entry ID <SortIndicator column="entry_id" />
                                    </div>
                                    {selectedType === 'All' && (
                                        <div
                                            style={{
                                                fontWeight: 'bold',
                                                padding: '8px',
                                                borderBottom: '1px solid #ccc',
                                                display: 'flex',
                                                alignItems: 'center',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            Type
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            fontWeight: 'bold',
                                            padding: '8px',
                                            borderBottom: '1px solid #ccc',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onClick={() => handleSort('name')}
                                    >
                                        Name <SortIndicator column="name" />
                                    </div>
                                    {selectedType !== 'id' && (
                                        <div
                                            style={{
                                                fontWeight: 'bold',
                                                padding: '8px',
                                                borderBottom: '1px solid #ccc',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                whiteSpace: 'nowrap'
                                            }}
                                            onClick={() => handleSort('value')}
                                        >
                                            Value <SortIndicator column="value" />
                                        </div>
                                    )}

                                    {getSortedResources().map((resource, index) => (
                                        <React.Fragment key={index}>
                                            <div style={{ padding: '8px', borderBottom: '1px solid #eee', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>0x{resource.entry_id.toString(16).toUpperCase()}</div>
                                            {selectedType === 'All' && (
                                                <div style={{ padding: '8px', borderBottom: '1px solid #eee', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{resource.type_name}</div>
                                            )}
                                            <div style={{ padding: '8px', borderBottom: '1px solid #eee', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{resource.name}</div>
                                            {selectedType !== 'id' && (
                                                <div style={{ padding: '8px', borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>
                                                    {resource.type_name !== 'attr' && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {typeof resource.value === 'object' && resource.value !== null
                                                            ? JSON.stringify(resource.value)
                                                            : resource.value}
                                                        {resource.value?.startsWith('#') && resource.value.length === 9 && (
                                                            <div style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                backgroundColor: `rgba(${parseInt(resource.value.slice(3, 5), 16)}, ${parseInt(resource.value.slice(5, 7), 16)}, ${parseInt(resource.value.slice(7, 9), 16)}, ${parseInt(resource.value.slice(1, 3), 16) / 255})`,
                                                                border: '1px solid #ccc',
                                                                borderRadius: '4px'
                                                            }} />
                                                        )}
                                                    </div>}
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </TabPanel>
                    ))}
                </Tabs>
            </div>
        </div>
    );
}

// Initialize WebAssembly when the component mounts
initializeWasm().catch(error => {
    console.error('Failed to initialize WebAssembly:', error);
    OUTPUT.render(<div style={{ color: 'red', padding: '10px' }}>Error: Failed to initialize WebAssembly module</div>);
});

// Initial render
OUTPUT.render(<App />);
