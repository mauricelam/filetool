import { createRoot } from 'react-dom/client'
import init, { ArscResource, decode_apk, extract_arsc, ApkMetadata } from './abxml-wasm-bindings/pkg'
import React, { useState, useEffect } from 'react'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'
import 'react-tabs/style/react-tabs.css'
import { ColumnView } from '../components/ColumnView'
import { PreviewComponent } from '../components/PreviewComponent';

const OUTPUT = createRoot(document.getElementById('output')!);
let wasmInitialized = false;

const initializeWasm = async () => {
    if (!wasmInitialized) {
        try {
            await init();
            wasmInitialized = true;
        } catch (error) {
            console.error('Failed to initialize WebAssembly:', error);
            throw error;
        }
    }
};

function pathToTree(paths: [string, string][]): { [key: string]: any } {
    const result = {}
    function addToTree(tree: { [key: string]: any }, pathComponents: string[], content: string) {
        if (pathComponents.length === 1) {
            tree[pathComponents[0]] = content
        } else {
            tree[pathComponents[0]] = tree[pathComponents[0]] || {}
            addToTree(tree[pathComponents[0]], pathComponents.slice(1), content)
        }
    }
    for (const [path, content] of paths) {
        const pathComponents = path.split('/')
        addToTree(result, pathComponents, content)
    }
    return result
}

function App() {
    const [view, setView] = useState<'file' | 'resource' | 'metadata'>('file');
    const [fileTree, setFileTree] = useState<{ [key: string]: any }>({});
    const [resources, setResources] = useState<ArscResource[]>([]);
    const [metadata, setMetadata] = useState<ApkMetadata | null>(null);
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

        // Check if it's an ARSC file
        if (file.name.endsWith('.arsc')) {
            const resources = extract_arsc(fileBytes);
            setResources(resources);
            setView('resource');
            return;
        }

        const decoded = decode_apk(fileBytes)
        const tree = pathToTree(decoded.files.map(([path, content]) => [path, new Uint8Array(content)] as any))
        setFileTree(tree);
        setMetadata(decoded.metadata);
        setView('file');
    }

    const handleItemClick = (level: number, key: string, content: any) => {
        // Check if it's an ARSC file
        if (key.endsWith('.arsc') && content instanceof Uint8Array) {
            const resources = extract_arsc(content);
            setResources(resources);
            setView('resource');
        }
    };

    if (error) {
        return <div style={{ color: 'red', padding: '10px' }}>Error: {error}</div>;
    }

    if (view === 'resource') {
        return <ResourceTableViewer resources={resources} onBack={() => setView('file')} />;
    }

    if (view === 'metadata') {
        return <MetadataViewer metadata={metadata} onBack={() => setView('file')} />;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {metadata && (
                <div style={{
                    padding: '10px 20px',
                    borderBottom: '1px solid #ccc',
                    backgroundColor: '#f9f9f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold' }}>{metadata.manifest?.package || 'Unknown APK'}</span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                            {metadata.manifest?.version_name} ({metadata.manifest?.version_code})
                        </span>
                    </div>
                    <button
                        onClick={() => setView('metadata')}
                        style={{
                            padding: '4px 12px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        View APK Metadata
                    </button>
                </div>
            )}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <FileViewer files={fileTree} onItemClick={handleItemClick} />
            </div>
        </div>
    );
}

function FileViewer({ files, onItemClick }: {
    files: { [key: string]: any },
    onItemClick: (level: number, key: string, content: any) => void,
}) {
    const handleOpenFile = async (file: Uint8Array, filename: string) => {
        const extractedFile = new File([file.buffer as ArrayBuffer], filename);
        window.parent?.postMessage({
            action: 'openFile',
            file: extractedFile
        }, "/", [await extractedFile.arrayBuffer()]);
    };

    const handleDownloadFile = async (file: Uint8Array, filename: string) => {
        const extractedFile = new File([file.buffer as ArrayBuffer], filename);
        const url = URL.createObjectURL(extractedFile);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = extractedFile.name;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const renderFileActions = (file: any, path: string[]) => {
        if (!window.parent || !(file instanceof Uint8Array)) return null;

        return (
            <div className="file-actions">
                <button onClick={() => handleOpenFile(file, path[path.length - 1])} title="Open">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                        <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z" />
                    </svg>
                </button>
                <button onClick={() => handleDownloadFile(file, path[path.length - 1])} title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                        <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z" />
                    </svg>
                </button>
            </div>
        );
    };

    const renderFilePreview = (file: Uint8Array, path: string[]) => {
        const extractFile = async () => {
            return new File([file.buffer as ArrayBuffer], path[path.length - 1]);
        };
        return <PreviewComponent path={path} filePromise={extractFile} />;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>APK Contents</h3>
            </div>
            <ColumnView
                initialContent={files}
                onItemClick={onItemClick}
                renderFileActions={renderFileActions}
                renderFilePreview={renderFilePreview}
            />
        </div>
    );
}

function ResourceTableViewer({ resources, onBack }: { resources: ArscResource[], onBack: () => void }) {
    // Group resources by type name
    const resourcesByType = resources.reduce((acc, resource) => {
        const typeName = resource.type_name;
        if (!acc[typeName]) {
            acc[typeName] = [];
        }
        acc[typeName].push(resource);
        return acc;
    }, {} as Record<string, any[]>);

    const [selectedType, setSelectedType] = useState<string>(Object.keys(resourcesByType)[0]);
    const [sortConfig, setSortConfig] = useState<{ key: 'entry_id' | 'name' | 'value', direction: 'asc' | 'desc' }>({
        key: 'entry_id',
        direction: 'asc'
    });

    const handleSort = (key: 'entry_id' | 'name' | 'value') => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    function getSortedResources(): ArscResource[] {
        const resources = resourcesByType[selectedType] || [];
        return [...resources].sort((a, b) => {
            let comparison = 0;
            if (sortConfig.key === 'entry_id') {
                comparison = a.entry_id - b.entry_id;
            } else if (sortConfig.key === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else {
                comparison = a.value.localeCompare(b.value);
            }
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }

    const SortIndicator = ({ column }: { column: 'entry_id' | 'name' | 'value' }) => (
        <span style={{ marginLeft: '4px' }}>
            {sortConfig.key === column && (sortConfig.direction === 'asc' ? '↑' : '↓')}
        </span>
    );

    const showValueColumn = selectedType !== 'id';

    const resourceTypes = Object.keys(resourcesByType);

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
                gap: '16px',
                marginBottom: '16px'
            }}>
                <button
                    onClick={onBack}
                    style={{
                        padding: '8px 16px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                        <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                    </svg>
                    Back
                </button>
                <h3 style={{ margin: 0 }}>Resource Table</h3>
            </div>

            {/* Type selector tabs */}
            <div style={{ marginBottom: '16px' }}>
                <Tabs
                    selectedIndex={resourceTypes.indexOf(selectedType)}
                    onSelect={(index) => setSelectedType(resourceTypes[index])}
                >
                    <TabList>
                        {resourceTypes.map(typeName => (
                            <Tab key={typeName}>{typeName}</Tab>
                        ))}
                    </TabList>

                    {resourceTypes.map(typeName => (
                        <TabPanel key={typeName}>
                            {/* Resource table */}
                            <div style={{
                                overflow: 'auto',
                                flex: 1,
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: selectedType !== 'id' ? 'auto auto auto' : 'auto auto',
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
                                            <div style={{ padding: '8px', borderBottom: '1px solid #eee', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{resource.name}</div>
                                            {selectedType !== 'id' && (
                                                <div style={{ padding: '8px', borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>
                                                    {resource.type_name !== 'attr' && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {resource.value}
                                                        {resource.value.startsWith('#') && resource.value.length === 9 && (
                                                            <div style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                backgroundColor: `rgba(${parseInt(resource.value.slice(3, 5), 16)}, ${parseInt(resource.value.slice(5, 7), 16)}, ${parseInt(resource.value.slice(7, 9), 16)}, ${parseInt(resource.value.slice(1, 3), 16) / 255})`,
                                                                border: '1px solid #ccc',
                                                                borderRadius: '4px'
                                                            }} />
                                                        )}
                                                    </div>}
                                                    {resource.entries && (
                                                        <div style={{ marginTop: '8px' }}>
                                                            {Object.entries(resource).map(([key, value], i) => (
                                                                <div key={i} style={{
                                                                    padding: '4px 0',
                                                                    borderTop: i > 0 ? '1px solid #eee' : 'none'
                                                                }}>
                                                                    <span style={{ fontWeight: 'bold' }}>{key}:</span> {value}
                                                                </div>
                                                            ))
                                                            }
                                                        </div>
                                                    )}
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

function MetadataViewer({ metadata, onBack }: { metadata: ApkMetadata | null, onBack: () => void }) {
    if (!metadata) return null;

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div style={{ padding: '20px', height: '100%', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <button
                    onClick={onBack}
                    style={{
                        padding: '8px 16px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                        <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                    </svg>
                    Back to Files
                </button>
                <h2 style={{ margin: 0 }}>APK Metadata</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <section style={{ border: '1px solid #eee', padding: '16px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '8px' }}>App Information</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold', width: '150px' }}>Package Name</td>
                                <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>{metadata.manifest?.package || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Version Name</td>
                                <td style={{ padding: '8px 0' }}>{metadata.manifest?.version_name || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Version Code</td>
                                <td style={{ padding: '8px 0' }}>{metadata.manifest?.version_code || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Min SDK</td>
                                <td style={{ padding: '8px 0' }}>{metadata.manifest?.min_sdk_version || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Target SDK</td>
                                <td style={{ padding: '8px 0' }}>{metadata.manifest?.target_sdk_version || 'N/A'}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section style={{ border: '1px solid #eee', padding: '16px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Archive Details</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold', width: '150px' }}>File Count</td>
                                <td style={{ padding: '8px 0' }}>{metadata.file_count}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Uncompressed Size</td>
                                <td style={{ padding: '8px 0' }}>{formatSize(metadata.uncompressed_size)}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section style={{ border: '1px solid #eee', padding: '16px', borderRadius: '8px', gridColumn: 'span 2' }}>
                    <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Signature Information</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: metadata.v1_signature ? '#4caf50' : '#ccc'
                            }}></div>
                            <span style={{ fontWeight: metadata.v1_signature ? 'bold' : 'normal' }}>V1 (JAR)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: metadata.v2_signature ? '#4caf50' : '#ccc'
                            }}></div>
                            <span style={{ fontWeight: metadata.v2_signature ? 'bold' : 'normal' }}>V2 (Block)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: metadata.v3_signature ? '#4caf50' : '#ccc'
                            }}></div>
                            <span style={{ fontWeight: metadata.v3_signature ? 'bold' : 'normal' }}>V3 (Block)</span>
                        </div>
                    </div>

                    {metadata.signers.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ marginBottom: '12px' }}>Signer Certificates</h4>
                            {metadata.signers.map((signer, i) => (
                                <div key={i} style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
                                    <div style={{ marginBottom: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Subject</div>
                                        <div style={{ fontWeight: 'bold' }}>{signer.subject}</div>
                                    </div>
                                    <div style={{ marginBottom: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>SHA-256 Digest</div>
                                        <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{signer.sha256_digest}</div>
                                    </div>
                                    <div style={{ marginBottom: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>SHA-1 Digest</div>
                                        <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{signer.sha1_digest}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>MD5 Digest</div>
                                        <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{signer.md5_digest}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {metadata.jar_signatures.length > 0 && (
                        <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>V1 Certificate Files:</div>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontFamily: 'monospace', fontSize: '13px' }}>
                                {metadata.jar_signatures.map((sig, i) => (
                                    <li key={i}>{sig}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>
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

