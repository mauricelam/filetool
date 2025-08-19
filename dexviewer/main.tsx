import { createRoot } from 'react-dom/client'
import React, { useState, useEffect } from 'react'
import init, { dex_classes, dex_methods, dex_instructions, JClass, JMethod, JInstruction, init_logger, load_proguard_mapping } from './dexviewer/pkg'

// Extended interface to include the new fields we added to JMethod
interface ExtendedJMethod extends JMethod {
    parameters: string[];
    return_type: string;
    access_flags: string;
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

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const OUTPUT = createRoot(document.getElementById('output')!)

function App({ file }: { file: File }) {
    const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
    const [classes, setClasses] = useState<JClass[]>([]);

    useEffect(() => {
        async function setup() {
            await init();
            init_logger();
            const bytes = new Uint8Array(await file.arrayBuffer());
            setFileBytes(bytes);
            const klasses = dex_classes(bytes);
            setClasses(klasses);
        }
        setup();
    }, [file]);

    const handleProguardUpload = (mappingContent: string) => {
        if (fileBytes) {
            load_proguard_mapping(mappingContent);
            const klasses = dex_classes(fileBytes);
            setClasses(klasses);
        }
    }

    if (classes.length === 0) {
        return <div>Loading...</div>
    }

    return (
        <>
            <ProguardUploader onUpload={handleProguardUpload} />
            <ClassTree classes={classes} dexfile={fileBytes!} />
        </>
    )
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
        <div>
            <label>
                Proguard mapping.txt:
                <input type="file" onChange={handleFileChange} />
            </label>
        </div>
    );
}

async function handleFile(file: File) {
    OUTPUT.render(<App file={file} />);
}

function ClassTree({ classes, dexfile }: { classes: JClass[], dexfile: Uint8Array }) {
    const [packageTree, setPackageTree] = useState<PackageNode | null>(null);

    useEffect(() => {
        const tree = buildPackageTree(classes);
        setPackageTree(tree);
    }, [classes]);

    if (!packageTree) {
        return <div>Building package tree...</div>;
    }

    return (
        <div className="package-tree">
            <PackageTreeNode node={packageTree} dexfile={dexfile} level={0} />
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

function PackageTreeNode({ node, dexfile, level }: { node: PackageNode, dexfile: Uint8Array, level: number }) {
    const [isExpanded, setIsExpanded] = useState(node.isExpanded);
    const hasContent = node.classes.length > 0 || node.subPackages.size > 0;
    const isRoot = level === 0;

    if (isRoot) {
        // For root node, just render children without the node itself
        return (
            <>
                {/* Render classes at root level */}
                {node.classes.map(javaClass => (
                    <DexClass key={javaClass.name} javaClass={javaClass} dexfile={dexfile} level={0} />
                ))}
                {/* Render sub-packages sorted alphabetically - start at level 1 for proper hierarchy */}
                {Array.from(node.subPackages.values())
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(subNode => (
                        <PackageTreeNode key={subNode.fullPath} node={subNode} dexfile={dexfile} level={1} />
                    ))}
            </>
        );
    }

    return (
        <div className="package-node">
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
                            <PackageTreeNode key={subNode.fullPath} node={subNode} dexfile={dexfile} level={level + 1} />
                        ))}
                    {/* Render classes in this package, sorted alphabetically */}
                    {node.classes
                        .sort((a, b) => a.original_name.localeCompare(b.original_name))
                        .map(javaClass => (
                            <DexClass key={javaClass.name} javaClass={javaClass} dexfile={dexfile} level={level + 1} />
                        ))}
                </div>
            )}
        </div>
    );
}


function DexClass({ javaClass, dexfile, level }: { javaClass: JClass, dexfile: Uint8Array, level: number }) {
    const [expanded, setExpanded] = useState(false)
    const [methods, setMethods] = useState<JMethod[]>([])
    const [loading, setLoading] = useState(false)

    const loadMethods = async () => {
        if (!expanded || methods.length > 0) return

        setLoading(true)
        try {
            const methods = dex_methods(dexfile, javaClass.id)
            setMethods(methods)
        } catch (error) {
            console.error('Error loading methods:', error)
        } finally {
            setLoading(false)
        }
    }

    // Load methods when expanded changes to true
    useEffect(() => {
        loadMethods()
    }, [expanded])

    const className = javaClass.original_name.split('.').pop() || javaClass.original_name;

    return (
        <div className={["dexclass", expanded ? "expanded" : ""].join(" ")}>
            <div className="class-header" onClick={() => setExpanded(current => !current)}>
                <span className="membername">{javaClass.original_name}</span>
                <span className="method-count">
                    {methods.length > 0 && `(${methods.length} methods)`}
                </span>
            </div>
            <div style={{ display: expanded ? 'block' : 'none', paddingLeft: 16 }}>
                {loading ? (
                    <div className="loading">Loading methods...</div>
                ) : (
                    methods.map(method => (
                        <DexMethod key={method.name} method={method as ExtendedJMethod} dexfile={dexfile} />
                    ))
                )}
            </div>
        </div>
    )
}

function DexMethod({ method, dexfile }: { method: ExtendedJMethod, dexfile: Uint8Array }) {
    const [expanded, setExpanded] = useState(false)
    const [instructions, setInstructions] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

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
        const params = method.parameters?.length > 0
            ? method.parameters.join(', ')
            : '';
        return `${method.return_type} ${method.name}(${params})`;
    }

    return (
        <div className={["method", expanded ? "expanded" : ""].join(" ")}>
            <div className="method-header" onClick={() => setExpanded(current => !current)}>
                {method.access_flags && (
                    <span className="access-flags">{method.access_flags} </span>
                )}
                <span className="method-name">{formatMethodSignature()}</span>
            </div>
            <div style={{ display: expanded ? 'block' : 'none', paddingLeft: 16 }}>
                {loading ? (<div>Loading instructions...</div>) :
                    instructions.length > 0 ? (
                        instructions.map((instruction, i) => (
                            <div className="instruction" key={i}>{instruction}</div>
                        ))
                    ) : (<div>No instructions found</div>)}
            </div>
        </div>
    )
}

