import { createRoot } from 'react-dom/client'
import React, { useState, useEffect, useRef } from 'react'
import init, { dex_classes, dex_methods, dex_fields, JClass, JMethod, JField, init_logger, load_proguard_mapping } from './dexviewer/pkg'
import { linkifySmaliInstruction, generateClassId, generateFieldId } from './linkify'

// Extended interface to include the new fields we added to JMethod
interface ExtendedJMethod extends JMethod {
    parameters: string[];
    return_type: string;
    access_flags: string;
}

// Extended shape for JClass to support newly added fields while staying compatible with current bindings
type ExtendedJClass = JClass & Partial<{
    access_flags: string;
    super_name: string | null;
    interfaces: string[];
    annotations: string[];
    method_names: string[];
}>;

// Expand the package tree path so the target class node is rendered
async function expandPackagePathForClass(fullClassName: string): Promise<void> {
    const parts = fullClassName.split('.')
    if (parts.length <= 1) return
    const packageParts = parts.slice(0, -1)

    // Wait for the tree to be rendered if it's not currently in DOM (e.g. after mode switch)
    const okTree = await waitFor(() => !!document.querySelector('.package-tree'), 2000, 50);
    if (!okTree) return
    const tree = document.querySelector('.package-tree') as HTMLElement

    // Start at the currently rendered container (root tree)
    let container: Element | null = tree
    for (const part of packageParts) {
        if (!container) break
        // Find the package header with the given name within the current container
        const headers = Array.from(container.querySelectorAll('.package-node > .package-header')) as HTMLElement[]
        const header = headers.find(h => (h.querySelector('.package-name')?.textContent || '').trim() === part)
        if (!header) break

        const node = header.parentElement as HTMLElement
        let content = node.querySelector(':scope > .package-content') as HTMLElement | null
        if (!content) {
            header.click()
            // Wait until this node's content renders
            await waitFor(() => !!node.querySelector(':scope > .package-content'), 2000, 50)
            content = node.querySelector(':scope > .package-content') as HTMLElement | null
        }
        container = content
    }
}

// Utility: wait until a condition is true, with timeout
function waitFor(predicate: () => boolean, timeoutMs = 2000, intervalMs = 50): Promise<boolean> {
    return new Promise((resolve) => {
        const start = Date.now()
        const tick = () => {
            if (predicate()) return resolve(true)
            if (Date.now() - start >= timeoutMs) return resolve(false)
            setTimeout(tick, intervalMs)
        }
        tick()
    })
}

interface PackageNode {
    name: string;
    fullPath: string;
    classes: JClass[];
    subPackages: Map<string, PackageNode>;
    isExpanded: boolean;
}

function getTotalClassCount(node: PackageNode): number {
    let count = node.classes.length;
    for (const subPackage of node.subPackages.values()) {
        count += getTotalClassCount(subPackage);
    }
    return count;
}

window.addEventListener('message', (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
});

// Generate a stable unique key for a method element
function getMethodKey(method: ExtendedJMethod): string {
    const params = (method.parameters || []).join(',')
    return `m|${method.class_id}|${method.name}|${params}|${method.return_type}`
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const OUTPUT = createRoot(document.getElementById('output')!)

interface UsageResult {
    className: string;
    methodName: string;
    instruction: string;
    classId: number;
}

function App({ file }: { file: File }) {
    const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
    const [classes, setClasses] = useState<JClass[]>([]);
    const [classSearchTerm, setClassSearchTerm] = useState('');
    const [apiSearchTerm, setApiSearchTerm] = useState('');
    const [usageResults, setUsageResults] = useState<UsageResult[]>([]);
    const [isSearchingUsages, setIsSearchingUsages] = useState(false);
    const [activeTab, setActiveTab] = useState<'packages' | 'search'>('packages');
    const resizerRef = useRef<HTMLDivElement | null>(null);
    const [sidebarWidth, setSidebarWidth] = useState(400);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [selectedClass, setSelectedClass] = useState<JClass | null>(null);
    const [targetMethodName, setTargetMethodName] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);

    const onNavigateToClass = (className: string) => {
        const dotted = className.replace(/\//g, '.');
        const targetClass = classes.find(c => c.original_name === dotted);
        if (targetClass) {
            setSelectedClass(targetClass);
        }
    };

    useEffect(() => {
        async function setup() {
            await init();
            init_logger();
            const bytes = new Uint8Array(await file.arrayBuffer());
            setFileBytes(bytes);
            const klasses = dex_classes(bytes);
            setClasses(klasses);

            // Initialize worker
            if (!workerRef.current) {
                const worker = new Worker(new URL('./search-worker.js', window.location.href));
                workerRef.current = worker;
                worker.onmessage = (e) => {
                    const { action, results } = e.data;
                    if (action === 'searchUsages') {
                        setUsageResults(results || []);
                        setIsSearchingUsages(false);
                    }
                };
                worker.postMessage({ action: 'setFileData', data: bytes });
            }

            // Also initialize Go WASM in main thread for getMethodInstructions
            if (!window['godexviewer']) {
                const go = new window['Go']()
                const result = await WebAssembly.instantiateStreaming(fetch('dextk.wasm'), go.importObject)
                go.run(result.instance)
            }
            if (window['godexviewer']?.setFileData) {
                window['godexviewer'].setFileData(bytes);
            }
        }
        setup();

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, [file]);

    const handleProguardUpload = (mappingContent: string) => {
        if (fileBytes) {
            load_proguard_mapping(mappingContent);
            const klasses = dex_classes(fileBytes);
            setClasses(klasses);
        }
    }

    const performUsageSearch = async () => {
        if (!apiSearchTerm || !workerRef.current) return;
        setIsSearchingUsages(true);
        workerRef.current.postMessage({ action: 'searchUsages', query: apiSearchTerm });
    };

    if (classes.length === 0) {
        return <div className="loading">Loading...</div>
    }

    const filteredClasses = classes.filter(c => {
        const search = classSearchTerm.toLowerCase();
        if (!search) return true;
        const jc = c as ExtendedJClass;
        return jc.original_name.toLowerCase().includes(search) ||
               (jc.method_names || []).some(m => m.toLowerCase().includes(search));
    });

    const handleResultClick = async (result: UsageResult) => {
        // Keep active tab as search for context
        // Clean up class name (remove L and ; if present, convert / to .)
        const className = result.className.replace(/^L|;$/g, '').replace(/\//g, '.');
        const targetClass = classes.find(c => c.original_name === className);
        if (targetClass) {
            // Force re-selection if it's the same class to trigger useEffect
            if (selectedClass?.id === targetClass.id) {
                setSelectedClass(null);
                setTimeout(() => {
                    setSelectedClass(targetClass);
                    setTargetMethodName(result.methodName);
                }, 0);
            } else {
                setSelectedClass(targetClass);
                setTargetMethodName(result.methodName);
            }
        }
    };

    const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

    const handleResizerMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.pageX;
        const startWidth = sidebarWidth;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth + (moveEvent.pageX - startX);
            if (newWidth > 150 && newWidth < 800) {
                setSidebarWidth(newWidth);
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'default';
            if (resizerRef.current) {
                resizerRef.current.classList.remove('resizing');
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
        if (resizerRef.current) {
            resizerRef.current.classList.add('resizing');
        }
    };

    return (
        <>
            <Header
                onProguardUpload={handleProguardUpload}
                searchTerm={classSearchTerm}
                onSearchChange={setClassSearchTerm}
            />
            <div className="main-container">
                <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`} style={{ width: sidebarWidth }}>
                    <div className="sidebar-tabs">
                        <button
                            className={`tab-button ${activeTab === 'packages' ? 'active' : ''}`}
                            onClick={() => setActiveTab('packages')}
                        >
                            Packages
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
                            onClick={() => setActiveTab('search')}
                        >
                            API Search
                        </button>
                    </div>
                    <div className="sidebar-content">
                        {activeTab === 'packages' ? (
                            <ClassTree
                                classes={filteredClasses}
                                dexfile={fileBytes!}
                                onClassSelect={(c) => setSelectedClass(c)}
                                selectedClassId={selectedClass?.id}
                            />
                        ) : (
                            <>
                                <div className="sidebar-search">
                                    <input
                                        type="text"
                                        className="search-input"
                                        value={apiSearchTerm}
                                        placeholder="Search API usage (e.g. android.util.Log)"
                                        onChange={(e) => setApiSearchTerm(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                performUsageSearch();
                                            }
                                        }}
                                    />
                                    <button className="search-button" onClick={performUsageSearch} disabled={isSearchingUsages}>
                                        {isSearchingUsages ? 'Searching...' : 'Search'}
                                    </button>
                                </div>
                                <UsageResults results={usageResults} onResultClick={handleResultClick} />
                            </>
                        )}
                    </div>
                </div>
                <div className="resizer" onMouseDown={handleResizerMouseDown} ref={resizerRef} />
                <div className="content-area">
                    <div className="sidebar-toggle" onClick={toggleSidebar}>
                        {isSidebarCollapsed ? '›' : '‹'}
                    </div>
                    {selectedClass ? (
                        <DexClass
                            key={selectedClass.id}
                            javaClass={selectedClass as ExtendedJClass}
                            dexfile={fileBytes!}
                            level={0}
                            initiallyExpanded={true}
                            onNavigateToClass={onNavigateToClass}
                            targetMethodName={targetMethodName}
                        />
                    ) : (
                        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                            Select a class from the sidebar to view its content.
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

function Header({ onProguardUpload, searchTerm, onSearchChange }: {
    onProguardUpload: (content: string) => void,
    searchTerm: string,
    onSearchChange: (term: string) => void
}) {
    return (
        <div className="header">
            <div className="search-container">
                <input
                    type="text"
                    className="search-input"
                    value={searchTerm}
                    placeholder="Filter classes or methods..."
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>
            <ProguardUploader onUpload={onProguardUpload} />
        </div>
    );
}

function UsageResults({ results, onResultClick }: { results: UsageResult[], onResultClick: (res: UsageResult) => void }) {
    const [displayLimit, setDisplayLimit] = useState(100);

    if (results.length === 0) {
        return <div className="usage-results-empty">No usages found.</div>
    }

    const displayedResults = results.slice(0, displayLimit);
    const hasMore = results.length > displayLimit;

    return (
        <div className="usage-results">
            <div className="usage-results-header">Found {results.length} usages</div>
            <div className="usage-results-list">
                {displayedResults.map((res, i) => (
                    <div key={i} className="usage-item" onClick={() => onResultClick(res)}>
                        <div className="usage-location">
                            <div className="type-name">{res.className.replace(/^L|;$/g, '').replace(/\//g, '.')}</div>
                            <div className="method-name">{res.methodName}</div>
                        </div>
                        <div className="usage-instruction">
                            <code>{res.instruction}</code>
                        </div>
                    </div>
                ))}
            </div>
            {hasMore && (
                <div className="usage-results-more">
                    <button className="load-more-button" onClick={() => setDisplayLimit(displayLimit + 100)}>
                        Load more ({results.length - displayLimit} remaining)
                    </button>
                </div>
            )}
        </div>
    );
}

function ProguardUploader({ onUpload }: { onUpload: (content: string) => void }) {
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }
        const mappingContent = await file.text();
        onUpload(mappingContent);
    };

    return (
        <div className="proguard-uploader-compact">
            <label>
                <svg className="proguard-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Proguard map
                <input type="file" onChange={handleFileChange} />
            </label>
        </div>
    );
}

async function handleFile(file: File) {
    OUTPUT.render(<App file={file} />);
}

function ClassTree({ classes, dexfile, onClassSelect, selectedClassId }: {
    classes: JClass[],
    dexfile: Uint8Array,
    onClassSelect: (c: JClass) => void,
    selectedClassId?: number
}) {
    const [packageTree, setPackageTree] = useState<PackageNode | null>(null);

    useEffect(() => {
        const tree = buildPackageTree(classes);
        setPackageTree(tree);
    }, [classes]);

    if (!packageTree) {
        return <div className="loading">Building package tree...</div>;
    }

    return (
        <div className="package-tree">
            <PackageTreeNode
                node={packageTree}
                dexfile={dexfile}
                level={0}
                onClassSelect={onClassSelect}
                selectedClassId={selectedClassId}
            />
        </div>
    );
}

function buildPackageTree(classes: JClass[]): PackageNode {
    const root: PackageNode = {
        name: 'root',
        fullPath: '',
        classes: [],
        subPackages: new Map(),
        isExpanded: true
    };

    classes.forEach(javaClass => {
        const className = javaClass.original_name;
        const parts = className.split('.');

        // If it's a simple class name without package, add to root
        if (parts.length === 1) {
            root.classes.push(javaClass);
            return;
        }

        let currentNode = root;
        const classNamePart = parts[parts.length - 1]; // The actual class name
        const packageParts = parts.slice(0, -1); // All but the last part (class name)

        // Navigate/create package hierarchy - each dot creates a new level
        packageParts.forEach((part, index) => {
            const fullPath = packageParts.slice(0, index + 1).join('.');

            if (!currentNode.subPackages.has(part)) {
                currentNode.subPackages.set(part, {
                    name: part,
                    fullPath,
                    classes: [],
                    subPackages: new Map(),
                    isExpanded: false // Start collapsed for better UX
                });
            }
            currentNode = currentNode.subPackages.get(part)!;
        });

        // Add class to the final package node
        currentNode.classes.push(javaClass);
    });

    return root;
}

function PackageTreeNode({ node, dexfile, level, onClassSelect, selectedClassId }: {
    node: PackageNode,
    dexfile: Uint8Array,
    level: number,
    onClassSelect: (c: JClass) => void,
    selectedClassId?: number
}) {
    const [isExpanded, setIsExpanded] = useState(node.isExpanded);
    const hasContent = node.classes.length > 0 || node.subPackages.size > 0;
    const isRoot = level === 0;

    if (isRoot) {
        // For root node, just render children without the node itself
        return (
            <>
                {/* Render classes at root level */}
                {node.classes.map(javaClass => (
                    <ClassListItem
                        key={javaClass.name}
                        javaClass={javaClass}
                        onSelect={onClassSelect}
                        isSelected={selectedClassId === javaClass.id}
                    />
                ))}
                {/* Render sub-packages sorted alphabetically - start at level 1 for proper hierarchy */}
                {Array.from(node.subPackages.values())
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(subNode => (
                        <PackageTreeNode
                            key={subNode.fullPath}
                            node={subNode}
                            dexfile={dexfile}
                            level={1}
                            onClassSelect={onClassSelect}
                            selectedClassId={selectedClassId}
                        />
                    ))}
            </>
        );
    }

    return (
        <div className={`package-node ${isExpanded ? 'expanded' : ''}`}>
            <div
                className="package-header"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ cursor: hasContent ? 'pointer' : 'default' }}
            >
                <span className="package-icon">
                    {hasContent ? (isExpanded ? '📂' : '📁') : '📄'}
                </span>
                <span className="package-name">{node.name}</span>
                <span className="package-count">
                    {(() => {
                        const totalClasses = getTotalClassCount(node);
                        const directClasses = node.classes.length;
                        const hasSubPackages = node.subPackages.size > 0;

                        if (totalClasses === 0) return null;

                        if (hasSubPackages && directClasses > 0) {
                            return `(${directClasses} + ${totalClasses - directClasses} classes)`;
                        } else if (hasSubPackages) {
                            return `(${totalClasses} classes)`;
                        } else {
                            return `(${directClasses} classes)`;
                        }
                    })()
                    }
                </span>
            </div>

            {isExpanded && (
                <div className="package-content">
                    {/* Render sub-packages first, sorted alphabetically */}
                    {Array.from(node.subPackages.values())
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(subNode => (
                            <PackageTreeNode
                                key={subNode.fullPath}
                                node={subNode}
                                dexfile={dexfile}
                                level={level + 1}
                                onClassSelect={onClassSelect}
                                selectedClassId={selectedClassId}
                            />
                        ))}
                    {/* Render classes in this package, sorted alphabetically */}
                    {node.classes
                        .sort((a, b) => a.original_name.localeCompare(b.original_name))
                        .map(javaClass => (
                            <ClassListItem
                                key={javaClass.name}
                                javaClass={javaClass}
                                onSelect={onClassSelect}
                                isSelected={selectedClassId === javaClass.id}
                            />
                        ))}
                </div>
            )}
        </div>
    );
}

function ClassListItem({ javaClass, onSelect, isSelected }: { javaClass: JClass, onSelect: (c: JClass) => void, isSelected: boolean }) {
    const simpleName = javaClass.original_name.split('.').pop();
    return (
        <div
            className={`class-list-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(javaClass)}
            style={{
                padding: '4px 8px 4px 28px',
                cursor: 'pointer',
                fontSize: '13px',
                color: isSelected ? '#2563eb' : '#4b5563',
                backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                borderRadius: '4px',
                margin: '1px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}
        >
            <span style={{ fontSize: '12px' }}>📄</span>
            <span className="class-name">{simpleName}</span>
        </div>
    )
}


function DexClass({ javaClass, dexfile, level, initiallyExpanded = false, onNavigateToClass, targetMethodName }: {
    javaClass: ExtendedJClass,
    dexfile: Uint8Array,
    level: number,
    initiallyExpanded?: boolean,
    onNavigateToClass?: (className: string) => void,
    targetMethodName?: string | null
}) {
    const [expanded, setExpanded] = useState(initiallyExpanded)
    const [showMembers, setShowMembers] = useState(initiallyExpanded)
    const [methods, setMethods] = useState<JMethod[]>([])
    const [fields, setFields] = useState<JField[]>([])
    const [loading, setLoading] = useState(false)
    const contentRef = useRef<HTMLDivElement | null>(null);

    const loadMembers = async () => {
        if (methods.length === 0 && fields.length === 0) {
            setLoading(true);
            try {
                const [m, f] = await Promise.all([
                    Promise.resolve(dex_methods(dexfile, javaClass.id)),
                    Promise.resolve(dex_fields(dexfile, javaClass.id)),
                ]);
                setMethods(m);
                setFields(f);
            } catch (error) {
                console.error('Error loading class members:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        if (initiallyExpanded) {
            loadMembers().then(() => {
                if (targetMethodName && contentRef.current) {
                    // Try to find the method and scroll to it
                    const checkInterval = setInterval(() => {
                        const methodEls = contentRef.current?.querySelectorAll('.method');
                        if (methodEls && methodEls.length > 0) {
                            let targetEl: HTMLElement | null = null;
                            methodEls.forEach(el => {
                                const nameEl = el.querySelector('.method-name');
                                if (nameEl && nameEl.textContent?.trim() === targetMethodName) {
                                    targetEl = el as HTMLElement;
                                }
                            });

                            if (targetEl) {
                                clearInterval(checkInterval);
                                // Ensure it's expanded
                                const header = (targetEl as HTMLElement).querySelector('.method-header') as HTMLElement;
                                const content = (targetEl as HTMLElement).querySelector('.method-content') as HTMLElement;
                                if (header && content && content.style.display === 'none') {
                                    header.click();
                                }
                                (header || targetEl).scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }
                    }, 100);
                    setTimeout(() => clearInterval(checkInterval), 2000);
                }
            });
        }
    }, [javaClass.id, initiallyExpanded, targetMethodName]);

    const toggleExpansion = async () => {
        const nextExpanded = !expanded;
        setExpanded(nextExpanded);

        if (nextExpanded && !showMembers) {
            setShowMembers(true);
            await loadMembers();
        }
    };


    const renderClassSignature = () => {
        const flags = javaClass.access_flags || ''
        const superName = javaClass.super_name || null
        const ifaces = javaClass.interfaces || []
        const simpleName = javaClass.original_name.split('.').pop();

        const ifaceNodes = ifaces.map((i, idx) => (
            <React.Fragment key={idx}>
                {idx > 0 && ', '}
                <span
                    className="class-link type-name"
                    style={{ textDecoration: 'underline', cursor: 'pointer' }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNavigateToClass?.(i) }}
                    title={i}
                >
                    {i.split('.').pop()}
                </span>
            </React.Fragment>
        ))

        return (
            <div className="class-signature">
                {flags.split(' ').map((f, i) => <span key={i} className="keyword">{f} </span>)}
                <span className="keyword">class </span>
                <span className="type-name" title={javaClass.original_name}>{simpleName}</span>
                {superName && (
                    <>
                        <span className="keyword"> extends </span>
                        <span
                            className="class-link type-name"
                            style={{ textDecoration: 'underline', cursor: 'pointer' }}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNavigateToClass?.(superName) }}
                            title={superName}
                        >
                            {superName.split('.').pop()}
                        </span>
                    </>
                )}
                {ifaceNodes.length > 0 && (
                    <>
                        <span className="keyword"> implements </span>
                        {ifaceNodes}
                    </>
                )}
                <span className="brace"> {'{'}</span>
                {!expanded && <span className="brace"> ... {'}'}</span>}
            </div>
        )
    }

    return (
        <div id={generateClassId(javaClass.original_name)} className={[
            "dexclass", expanded ? "expanded" : ""
        ].join(" ")} style={{ height: initiallyExpanded ? '100%' : 'auto', display: 'flex', flexDirection: 'column' }}>
            <div className="class-header" onClick={toggleExpansion} style={{ cursor: initiallyExpanded ? 'default' : 'pointer' }}>
                {javaClass.annotations && javaClass.annotations.length > 0 && (
                    <div className="class-annotations">
                        {javaClass.annotations.map((a, i) => (
                            <div key={i} className="annotation">@{a.split('.').pop()}</div>
                        ))}
                    </div>
                )}
                {renderClassSignature()}
            </div>
            <div ref={contentRef} style={{ display: expanded && showMembers ? 'block' : 'none', paddingLeft: 16, flex: initiallyExpanded ? 1 : 'none', overflowY: initiallyExpanded ? 'auto' : 'visible' }} className="class-content">
                {loading ? (
                    <div className="loading">Loading members...</div>
                ) : (
                    <>
                        {/* Fields */}
                        {fields.length > 0 && (
                            <div className="fields">
                                {fields.map((field) => {
                                    const isPrimitive = /^(void|boolean|byte|short|char|int|long|float|double)(\[\])*$/.test(field.type_name)
                                    const typeSimple = field.type_name.split('.').pop()
                                    const typeNode = isPrimitive ? (
                                        <span className="type-name">{field.type_name}</span>
                                    ) : (
                                        <span
                                            className="class-link type-name"
                                            style={{ textDecoration: 'underline', cursor: 'pointer' }}
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNavigateToClass?.(field.type_name) }}
                                            title={field.type_name}
                                        >
                                            {typeSimple}
                                        </span>
                                    )
                                    return (
                                        <div key={field.name} id={generateFieldId(javaClass.original_name, field.name)} className="field">
                                            <div className="field-header">
                                                {field.access_flags && field.access_flags.split(' ').map((f, i) => <span key={i} className="keyword">{f} </span>)}
                                                {typeNode} <span className="field-name">{field.name}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        {/* Methods */}
                        {methods.map(method => (
                            <DexMethod
                                key={getMethodKey(method as ExtendedJMethod)}
                                method={method as ExtendedJMethod}
                                dexfile={dexfile}
                                onNavigateToClass={onNavigateToClass}
                            />
                        ))}
                    </>
                )}
                <div className="brace" style={{ marginLeft: -16 }}>{'}'}</div>
            </div>
        </div>
    )
}

function DexMethod({ method, dexfile, onNavigateToClass }: {
    method: ExtendedJMethod,
    dexfile: Uint8Array,
    onNavigateToClass?: (className: string) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const [instructions, setInstructions] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const containerRef = useRef<HTMLDivElement | null>(null)

    const loadInstructions = async () => {
        if (!expanded || instructions.length > 0) return
        setLoading(true)
        try {
            if (!window['godexviewer']) {
                const go = new window['Go']()
                const result = await WebAssembly.instantiateStreaming(fetch('dextk.wasm'), go.importObject)
                go.run(result.instance)
            }
            const dextk = window['godexviewer']
            const methodInstructions = dextk.getMethodInstructions(dexfile, method.class_id, method.name)
            setInstructions(methodInstructions || [])
        } catch (error) {
            console.error('Error loading instructions:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadInstructions() }, [expanded])

    const formatMethodSignature = () => {
        const params = method.parameters?.length > 0 ? method.parameters.map(p => p.split('.').pop()).join(', ') : ''
        return (
            <div className="method-signature">
                {method.access_flags && method.access_flags.split(' ').map((f, i) => <span key={i} className="keyword">{f} </span>)}
                <span className="type-name">{method.return_type.split('.').pop()} </span>
                <span className="method-name">{method.name}</span>
                <span className="brace">(</span>
                {params}
                <span className="brace">) </span>
                {!expanded && <span className="brace">{'{ ... }'}</span>}
                {expanded && <span className="brace">{'{'}</span>}
            </div>
        )
    }

    return (
        <div className={["method", expanded ? "expanded" : ""].join(" ")}>
            <div className="method-header" onClick={() => setExpanded(current => !current)}>
                {formatMethodSignature()}
            </div>
            <div style={{ display: expanded ? 'block' : 'none' }} ref={containerRef} className="method-content">
                {loading ? (
                    <div className="loading">Loading instructions...</div>
                ) : instructions.length > 0 ? (
                    instructions.map((instruction, i) => (
                        <div key={i} className="instruction-line">
                            <InstructionLine
                                instruction={instruction}
                                onNavigateToClass={onNavigateToClass}
                            />
                        </div>
                    ))
                ) : (
                    <div className="loading">No instructions found</div>
                )}
                <div className="brace" style={{ marginLeft: -16 }}>{'}'}</div>
            </div>
        </div>
    )
}

function InstructionLine({ instruction, onNavigateToClass }: { instruction: string, onNavigateToClass?: (className: string) => void }) {
    const lineRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!lineRef.current) return

        // Clear existing contents first
        lineRef.current.textContent = ''

        const fragment = linkifySmaliInstruction(
            instruction,
            // onMethodClick
            (ref) => {
                onNavigateToClass?.(ref.className);
                // After navigation, we might need to find the method in the new view.
                // This is slightly complex since DexClass is re-rendering.
                // We'll handle this in the parent App or by passing down method to scroll to.
            },
            // onClassClick
            (className) => {
                onNavigateToClass?.(className);
            },
            // onFieldClick
            (fieldRef) => {
                onNavigateToClass?.(fieldRef.className);
            }
        )

        lineRef.current.appendChild(fragment)
    }, [instruction, onNavigateToClass])

    return (
        <div
            ref={lineRef}
            style={{
                fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: '0.9em',
                whiteSpace: 'pre-wrap',
            }}
        />
    )
}

function findBestMethodMatch(methodEls: NodeListOf<Element>, methodName: string, paramDescriptor: string): HTMLElement | null {
    const desiredCount = countDescriptorParams(paramDescriptor)
    const candidates: { el: HTMLElement; name: string; count: number }[] = []

    methodEls.forEach(el => {
        const nameEl = el.querySelector('.method-header .method-name') as HTMLElement | null
        if (!nameEl) return
        const text = (nameEl.textContent || '').trim()

        // Extract the token right before '(' as the method name, ignoring return type
        // Examples:
        //  - "void setParent(Type)"
        //  - "protected static <T> map(List<T>)"
        const parenIdx = text.indexOf('(')
        if (parenIdx === -1) return
        const beforeParen = text.slice(0, parenIdx).trim()
        const displayedNameMatch = beforeParen.match(/(?:^|\s)(<init>|<clinit>|[a-zA-Z_$][a-zA-Z0-9_$<>]*)$/)
        const displayedName = displayedNameMatch ? displayedNameMatch[1] : ''

        // Get the parameter list between parentheses
        const closeIdx = text.indexOf(')', parenIdx + 1)
        const paramsText = closeIdx !== -1 ? text.slice(parenIdx + 1, closeIdx).trim() : ''
        const count = paramsText ? paramsText.split(',').filter(s => s.trim().length > 0).length : 0

        // Collect candidates that match by name, or where the text clearly contains `${methodName}(` as a fallback
        const nameMatches = displayedName === methodName || text.includes(`${methodName}(`)
        if (nameMatches) {
            candidates.push({ el: el as HTMLElement, name: displayedName || methodName, count })
        }
    })

    if (candidates.length === 0) return null

    // Prefer exact count match
    const exact = candidates.find(c => c.count === desiredCount)
    if (exact) return exact.el

    // If only one candidate by name, take it
    if (candidates.length === 1) return candidates[0].el

    // Fallback: return the first candidate
    return candidates[0].el
}

function countDescriptorParams(descriptor: string): number {
    // Accept inputs like: (II)V, (Lpkg/Name;[I)Z, ([]), or with spaces e.g. ([Lpkg/Name; Lpkg/Other; Z])
    if (!descriptor) return 0
    // Normalize: remove whitespace
    const d = descriptor.replace(/\s+/g, '')
    if (d === '()' || d === '([])') return 0
    // Ensure we only parse inside parentheses
    if (!d.startsWith('(') || d.indexOf(')') === -1) return 0
    let i = 1 // start after '('
    let count = 0
    while (i < d.length) {
        const ch = d[i]
        if (ch === ')') break
        if (ch === '[') {
            // arrays: consume all '['
            while (d[i] === '[') i++
            if (d[i] === 'L') {
                while (i < d.length && d[i] !== ';') i++
                if (d[i] === ';') i++
            } else {
                // primitive array element
                i++
            }
            count++
            continue
        }
        if (ch === 'L') {
            while (i < d.length && d[i] !== ';') i++
            if (d[i] === ';') i++
            count++
            continue
        }
        // primitive type
        i++
        count++
    }
    return count
}
