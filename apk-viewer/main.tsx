import { createRoot } from 'react-dom/client'
import init, { ArscResource, decode_apk, extract_arsc, ApkMetadata, ArscValue, decompress_brotli } from './apk-wasm-bindings/pkg'
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ColumnView } from '../components/ColumnView'
import { PreviewComponent } from '../components/PreviewComponent';
import { MantineProvider, Table, Tabs, Button, Group, Text, Anchor, ActionIcon, Stack, Box, ScrollArea, TextInput, Collapse } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import '@mantine/core/styles.css';

const OUTPUT = createRoot(document.getElementById('output')!);
let wasmInitialized = false;
let systemResources: Uint8Array | null = null;

interface ResourceTableState {
    selectedType: string;
    filter: string;
    sortConfig: { key: 'entry_id' | 'name', direction: 'asc' | 'desc' };
    scrollTop?: number;
}

const initializeWasm = async () => {
    if (!wasmInitialized) {
        try {
            await init();

            // Load system resources
            const response = await fetch('android.arsc.br');
            if (!response.ok) throw new Error('Failed to fetch android.arsc.br');
            const compressedResources = new Uint8Array(await response.arrayBuffer());
            systemResources = decompress_brotli(compressedResources);

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

function App() {
    const [view, setView] = useState<'file' | 'resource' | 'metadata' | 'file-preview'>('file');
    const [fileTree, setFileTree] = useState<{ [key: string]: any }>({});
    const [selectedFilePath, setSelectedFilePath] = useState<string[] | undefined>(undefined);
    const [previewPath, setPreviewPath] = useState<string[] | null>(null);
    const [previewContent, setPreviewContent] = useState<Uint8Array | null>(null);
    const [resources, setResources] = useState<ArscResource[]>([]);
    const [metadata, setMetadata] = useState<ApkMetadata | null>(null);
    const [error, setError] = useState<string | null>(null);

    // State for ResourceTableViewer to persist across view changes
    const [resTableState, setResTableState] = useState<ResourceTableState>({
        selectedType: 'style',
        filter: '',
        sortConfig: { key: 'entry_id', direction: 'asc' }
    });

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
        if (!systemResources) throw new Error("System resources not loaded");
        const fileBytes = new Uint8Array(await file.arrayBuffer());

        const decoded = decode_apk(fileBytes, systemResources)
        const tree = pathToTree(decoded.files.map(([path, content]) => [path, new Uint8Array(content)] as any))
        setFileTree(tree);
        setMetadata(decoded.metadata);
        setView('file');
    }

    const handleItemClick = (level: number, key: string, content: any) => {
        // Check if it's an ARSC file
        if (key.endsWith('.arsc') && content instanceof Uint8Array) {
            if (!systemResources) throw new Error("System resources not loaded");
            const resources = extract_arsc(content, systemResources);
            setResources(resources);
            setView('resource');
        }
    };

    const handleNavigateToFile = useCallback((path: string, currentScrollTop?: number) => {
        const pathArr = path.split('/');
        // Try to find the file in fileTree to preview it
        let current = fileTree;
        for (const segment of pathArr) {
            if (current && typeof current === 'object' && segment in current) {
                current = current[segment];
            } else {
                current = null;
                break;
            }
        }

        if (currentScrollTop !== undefined) {
            setResTableState(prev => ({ ...prev, scrollTop: currentScrollTop }));
        }

        if (current instanceof Uint8Array) {
            setPreviewPath(pathArr);
            setPreviewContent(current);
            setView('file-preview');
        } else {
            setSelectedFilePath(pathArr);
            setView('file');
        }
    }, [fileTree]);

    if (error) {
        return <div style={{ color: 'red', padding: '10px' }}>Error: {error}</div>;
    }

    let content;
    if (view === 'resource') {
        content = (
            <ResourceTableViewer
                resources={resources}
                onBack={() => setView('file')}
                onNavigateToFile={(path, scrollTop) => handleNavigateToFile(path, scrollTop)}
                state={resTableState}
                onStateChange={setResTableState}
            />
        );
    } else if (view === 'file-preview') {
        content = (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                    <Button
                        variant="default"
                        onClick={() => setView('resource')}
                        leftSection={
                            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                                <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                            </svg>
                        }
                    >
                        Back to Resources
                    </Button>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <PreviewComponent path={previewPath!} filePromise={async () => new File([previewContent!.buffer], previewPath![previewPath!.length - 1])} />
                </div>
            </div>
        );
    } else if (view === 'metadata') {
        content = <MetadataViewer metadata={metadata} onBack={() => setView('file')} />;
    } else {
        content = (
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
                        <Button
                            variant="outline"
                            size="compact-sm"
                            onClick={() => setView('metadata')}
                        >
                            View APK Metadata
                        </Button>
                    </div>
                )}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <FileViewer files={fileTree} onItemClick={handleItemClick} selectedPath={selectedFilePath} />
                </div>
            </div>
        );
    }

    return (
        <MantineProvider>
            {content}
        </MantineProvider>
    );
}

function FileViewer({ files, onItemClick, selectedPath }: {
    files: { [key: string]: any },
    onItemClick: (level: number, key: string, content: any) => void,
    selectedPath?: string[],
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
                <ActionIcon variant="subtle" onClick={() => handleOpenFile(file, path[path.length - 1])} title="Open">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                        <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z" />
                    </svg>
                </ActionIcon>
                <ActionIcon variant="subtle" onClick={() => handleDownloadFile(file, path[path.length - 1])} title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                        <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z" />
                    </svg>
                </ActionIcon>
            </div>
        );
    };

    const getDexFiles = (obj: any): { name: string, content: Uint8Array }[] => {
        const results: { name: string, content: Uint8Array }[] = [];
        const find = (o: any) => {
            for (const key in o) {
                const item = o[key];
                if (item instanceof Uint8Array) {
                    if (key.toLowerCase().endsWith('.dex')) {
                        results.push({ name: key, content: item });
                    }
                } else if (item && typeof item === 'object') {
                    find(item);
                }
            }
        };
        find(obj);
        return results;
    };

    const handleOpenMultiDex = async () => {
        const dexFiles = getDexFiles(files);

        if (dexFiles.length === 0) return;

        try {
            // Sort to have classes.dex first if possible
            dexFiles.sort((a, b) => a.name.localeCompare(b.name));

            const extractedFiles = dexFiles.map(f => new File([f.content.buffer as ArrayBuffer], f.name));
            const primaryFile = extractedFiles[0];
            const additionalFiles = extractedFiles.slice(1);

            window.parent?.postMessage({
                action: 'openFile',
                file: primaryFile,
                additionalFiles: additionalFiles,
                handler: 'dexviewer'
            }, "/", [
                await primaryFile.arrayBuffer(),
                ...await Promise.all(additionalFiles.map(f => f.arrayBuffer()))
            ]);
        } catch (e) {
            console.error('Error opening multiple DEX files:', e);
        }
    };

    const renderFilePreview = (file: Uint8Array, path: string[]) => {
        const extractFile = async () => {
            return new File([file.buffer as ArrayBuffer], path[path.length - 1]);
        };
        return <PreviewComponent path={path} filePromise={extractFile} />;
    };

    const hasMultipleDex = getDexFiles(files).length > 1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>APK Contents</h3>
                {hasMultipleDex && (
                    <Button
                        size="compact-sm"
                        onClick={handleOpenMultiDex}
                        variant="light"
                    >
                        Analyze all DEX files
                    </Button>
                )}
            </div>
            <ColumnView
                initialContent={files}
                selectedPath={selectedPath}
                onItemClick={onItemClick}
                renderFileActions={renderFileActions}
                renderFilePreview={renderFilePreview}
            />
        </div>
    );
}

function ArscValueRenderer({ value, onNavigateToFile, onNavigateToResource }: {
    value: ArscValue,
    onNavigateToFile: () => void,
    onNavigateToResource: (resId: number) => void
}) {
    if (value.ref_id) {
        return (
            <Anchor
                component="button"
                size="sm"
                onClick={() => onNavigateToResource(value.ref_id!)}
            >
                {value.value}
            </Anchor>
        );
    }

    if (typeof value.value === 'string' && value.value.startsWith('res/')) {
        return (
            <Anchor
                component="button"
                size="sm"
                onClick={onNavigateToFile}
            >
                {value.value}
            </Anchor>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text size="sm">{value.value}</Text>
            {typeof value.value === 'string' && value.value.startsWith('#') && (value.value.length === 9 || value.value.length === 7) && (
                <div style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: value.value.length === 9
                        ? `rgba(${parseInt(value.value.slice(3, 5), 16)}, ${parseInt(value.value.slice(5, 7), 16)}, ${parseInt(value.value.slice(7, 9), 16)}, ${parseInt(value.value.slice(1, 3), 16) / 255})`
                        : value.value,
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                }} />
            )}
        </div>
    );
}

function ResourceTableViewer({ resources, onBack, onNavigateToFile, state, onStateChange }: {
    resources: ArscResource[],
    onBack: () => void,
    onNavigateToFile: (path: string, scrollTop: number) => void,
    state: ResourceTableState,
    onStateChange: React.Dispatch<React.SetStateAction<ResourceTableState>>
}) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        entry_id: 120,
        name: 300,
        values: 500,
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

    const resourcesByType = useMemo(() => resources.reduce((acc, resource) => {
        const typeName = resource.type_name;
        if (!acc[typeName]) {
            acc[typeName] = [];
        }
        acc[typeName].push(resource);
        return acc;
    }, {} as Record<string, ArscResource[]>), [resources]);

    const resourceTypes = useMemo(() => Object.keys(resourcesByType), [resourcesByType]);

    const selectedType = state.selectedType || resourceTypes[0] || '';
    const filter = state.filter;
    const sortConfig = state.sortConfig;

    const setSelectedType = useCallback((newType: string | null) => {
        if (newType) {
            onStateChange(prev => ({ ...prev, selectedType: newType, scrollTop: 0 }));
        }
    }, [onStateChange]);

    const setFilter = useCallback((newFilter: string) => {
        onStateChange(prev => ({ ...prev, filter: newFilter }));
    }, [onStateChange]);

    const setSortConfig = useCallback((newSortConfig: { key: 'entry_id' | 'name', direction: 'asc' | 'desc' }) => {
        onStateChange(prev => ({ ...prev, sortConfig: newSortConfig }));
    }, [onStateChange]);

    useEffect(() => {
        if (resourceTypes.length > 0 && (!state.selectedType || !resourceTypes.includes(state.selectedType))) {
            setSelectedType(resourceTypes[0]);
        }
    }, [resourceTypes, state.selectedType, setSelectedType]);

    useEffect(() => {
        if (viewportRef.current && state.scrollTop) {
            viewportRef.current.scrollTop = state.scrollTop;
        }
    }, []);

    const onNavigateToResource = useCallback((resId: number) => {
        const targetRes = resources.find(r => r.entry_id === resId);
        if (targetRes) {
            setSelectedType(targetRes.type_name);
            const hexId = `0x${resId.toString(16).toUpperCase()}`;
            setTimeout(() => {
                const el = document.getElementById(`res-${hexId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.style.backgroundColor = '#fff9c4';
                    setTimeout(() => {
                        el.style.backgroundColor = '';
                    }, 2000);
                }
            }, 100);
        }
    }, [resources, setSelectedType]);

    const handleSort = (key: 'entry_id' | 'name') => {
        setSortConfig({
            key,
            direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
        });
    };

    const handleNavigateToFileInternal = useCallback((path: string) => {
        const scrollTop = viewportRef.current?.scrollTop || 0;
        onNavigateToFile(path, scrollTop);
    }, [onNavigateToFile]);

    const filteredResources = useMemo(() => {
        let items = resourcesByType[selectedType] || [];
        if (filter) {
            const lowFilter = filter.toLowerCase();
            items = items.filter(r =>
                r.name.toLowerCase().includes(lowFilter) ||
                r.entry_id.toString(16).toLowerCase().includes(lowFilter) ||
                r.values.some(v => v.value.value.toLowerCase().includes(lowFilter))
            );
        }
        return items.sort((a, b) => {
            let comparison = 0;
            if (sortConfig.key === 'entry_id') {
                comparison = a.entry_id - b.entry_id;
            } else {
                comparison = a.name.localeCompare(b.name);
            }
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [resourcesByType, selectedType, sortConfig, filter]);

    const SortIndicator = ({ column }: { column: 'entry_id' | 'name' }) => (
        <span style={{ marginLeft: '4px' }}>
            {sortConfig.key === column && (sortConfig.direction === 'asc' ? '↑' : '↓')}
        </span>
    );

    return (
        <div style={{
            padding: '20px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            <style>
                {`
                    .resize-handle:hover {
                        background-color: #228be6;
                    }
                `}
            </style>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
            }}>
                <Group>
                    <Button
                        variant="default"
                        onClick={onBack}
                        leftSection={
                            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                                <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                            </svg>
                        }
                    >
                        Back
                    </Button>
                    <h3 style={{ margin: 0 }}>Resource Table</h3>
                </Group>
                <TextInput
                    placeholder="Filter resources..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{ width: '300px' }}
                />
            </div>

            <Tabs value={selectedType} onChange={setSelectedType} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Tabs.List>
                    {resourceTypes.map(typeName => (
                        <Tabs.Tab key={typeName} value={typeName}>{typeName}</Tabs.Tab>
                    ))}
                </Tabs.List>

                <div style={{ flex: 1, overflow: 'hidden', marginTop: '16px' }}>
                    <ScrollArea style={{ height: '100%' }} viewportRef={viewportRef}>
                        <Table striped highlightOnHover withBorder withColumnBorders style={{ tableLayout: 'fixed', width: '100%' }}>
                            <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                                <Table.Tr>
                                    <Table.Th style={{ cursor: 'pointer', width: columnWidths.entry_id, position: 'relative' }} onClick={() => handleSort('entry_id')}>
                                        Entry ID <SortIndicator column="entry_id" />
                                        <ResizeHandle onMouseDown={handleResize('entry_id')} />
                                    </Table.Th>
                                    <Table.Th style={{ cursor: 'pointer', width: columnWidths.name, position: 'relative' }} onClick={() => handleSort('name')}>
                                        Name <SortIndicator column="name" />
                                        <ResizeHandle onMouseDown={handleResize('name')} />
                                    </Table.Th>
                                    {selectedType !== 'id' && (
                                        <Table.Th style={{ width: columnWidths.values, position: 'relative' }}>
                                            Values
                                            <ResizeHandle onMouseDown={handleResize('values')} />
                                        </Table.Th>
                                    )}
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {filteredResources.map((resource, index) => (
                                    <Table.Tr key={index} id={`res-0x${resource.entry_id.toString(16).toUpperCase()}`}>
                                        <Table.Td style={{ fontFamily: 'monospace', width: columnWidths.entry_id, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            0x{resource.entry_id.toString(16).toUpperCase()}
                                        </Table.Td>
                                        <Table.Td style={{ fontFamily: 'monospace', width: columnWidths.name, overflow: 'hidden' }}>
                                            <Stack gap={4}>
                                                <Text size="sm" ff="monospace">{resource.name}</Text>
                                                {resource.parent_id && (
                                                    <Group gap={4}>
                                                        <Text size="xs" c="dimmed">Parent:</Text>
                                                        <Anchor
                                                            component="button"
                                                            size="xs"
                                                            onClick={() => onNavigateToResource(resource.parent_id!)}
                                                        >
                                                            {resource.parent_name || `0x${resource.parent_id.toString(16).toUpperCase()}`}
                                                        </Anchor>
                                                    </Group>
                                                )}
                                            </Stack>
                                        </Table.Td>
                                        {selectedType !== 'id' && (
                                            <Table.Td style={{ width: columnWidths.values, overflow: 'hidden' }}>
                                            <ResourceValues resource={resource} onNavigateToFile={handleNavigateToFileInternal} onNavigateToResource={onNavigateToResource} />
                                            </Table.Td>
                                        )}
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>
                </div>
            </Tabs>
        </div>
    );
}

function ResourceValues({ resource, onNavigateToFile, onNavigateToResource }: {
    resource: ArscResource,
    onNavigateToFile: (path: string) => void,
    onNavigateToResource: (resId: number) => void
}) {
    const [opened, { toggle }] = useDisclosure(false);
    const defaultValue = resource.values.find(v => v.config === 'default') || resource.values[0];
    const otherValues = resource.values.filter(v => v !== defaultValue);

    return (
        <Stack gap={4}>
            <Box>
                {resource.values.length > 1 && <Text size="xs" c="dimmed" fw={700}>default:</Text>}
                <ArscConfigValueRenderer configValue={defaultValue} onNavigateToFile={onNavigateToFile} onNavigateToResource={onNavigateToResource} />
            </Box>

            {otherValues.length > 0 && (
                <>
                    <Button variant="subtle" size="compact-xs" onClick={toggle} style={{ width: 'fit-content' }}>
                        {opened ? 'Hide' : `Show ${otherValues.length} more configurations`}
                    </Button>
                    <Collapse in={opened}>
                        <Stack gap={8} mt={4}>
                            {otherValues.map((cv, i) => (
                                <Box key={i} pl="md" style={{ borderLeft: '2px solid #eee' }}>
                                    <Text size="xs" c="dimmed" fw={700}>{cv.config}:</Text>
                                    <ArscConfigValueRenderer configValue={cv} onNavigateToFile={onNavigateToFile} onNavigateToResource={onNavigateToResource} />
                                </Box>
                            ))}
                        </Stack>
                    </Collapse>
                </>
            )}
        </Stack>
    );
}

function ArscConfigValueRenderer({ configValue, onNavigateToFile, onNavigateToResource }: {
    configValue: any,
    onNavigateToFile: (path: string) => void,
    onNavigateToResource: (resId: number) => void
}) {
    return (
        <Stack gap={4}>
            <ArscValueRenderer value={configValue.value} onNavigateToFile={() => onNavigateToFile(configValue.value.value)} onNavigateToResource={onNavigateToResource} />
            {configValue.entries && (
                <Box pl="md" style={{ borderLeft: '2px solid #eee' }}>
                    {configValue.entries.map(([key, val], i) => (
                        <Group key={i} gap="xs" wrap="nowrap">
                            <Text size="xs" fw={700} style={{ whiteSpace: 'nowrap' }}>{key}:</Text>
                            <ArscValueRenderer value={val} onNavigateToFile={onNavigateToFile} onNavigateToResource={onNavigateToResource} />
                        </Group>
                    ))}
                </Box>
            )}
        </Stack>
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
                <Button
                    variant="default"
                    onClick={onBack}
                    leftSection={
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                            <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                        </svg>
                    }
                >
                    Back to Files
                </Button>
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
