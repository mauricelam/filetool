import { createRoot } from 'react-dom/client'
import React, { useState, useEffect } from 'react'
import init, { dex_classes, dex_methods, dex_instructions, JClass, JMethod, JInstruction, init_logger, load_proguard_mapping } from './dexviewer/pkg'

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const OUTPUT = createRoot(document.getElementById('output'))

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
            <ClassTree classes={classes} dexfile={fileBytes} />
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
    return classes.map(javaClass => <DexClass key={javaClass.name} javaClass={javaClass} dexfile={dexfile} />)
}


function DexClass({ javaClass, dexfile }: { javaClass: JClass, dexfile: Uint8Array }) {
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

    return (
        <div className={["dexclass", expanded ? "expanded" : ""].join(" ")}>
            <div className="membername" onClick={() => setExpanded(current => !current)}>
                {javaClass.original_name}
            </div>
            <div style={{ display: expanded ? 'block' : 'none', paddingLeft: 16 }}>
                {loading ? (
                    <div>Loading methods...</div>
                ) : (
                    methods.map(method => (
                        <DexMethod key={method.name} method={method} dexfile={dexfile} />
                    ))
                )}
            </div>
        </div>
    )
}

function DexMethod({ method, dexfile }: { method: JMethod, dexfile: Uint8Array }) {
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

    return (
        <div className={["method", expanded ? "expanded" : ""].join(" ")}>
            <div className="method membername" onClick={() => setExpanded(current => !current)}>
                {method.name}
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

