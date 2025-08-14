import { createRoot } from 'react-dom/client'
import React, { useState, useEffect } from 'react'

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
    const [dextk, setDextk] = useState(null);
    const [classes, setClasses] = useState([]);
    const [dexId, setDexId] = useState(-1);

    useEffect(() => {
        async function setup() {
            const fileBytes = new Uint8Array(await file.arrayBuffer());
            const go = new window['Go']()
            const result = await WebAssembly.instantiateStreaming(fetch('dextk.wasm'), go.importObject)
            go.run(result.instance)
            const dextk = window['godexviewer']
            setDextk(dextk);
            const id = dextk.createDex(fileBytes)
            setDexId(id);
            const klasses = dextk.getClasses(id)
            setClasses(klasses);
        }
        setup();
    }, [file]);

    const handleProguardUpload = async (mappingContent: string) => {
        if (dextk) {
            dextk.loadProguardMapping(mappingContent);
            // re-fetch classes
            const klasses = dextk.getClasses(dexId);
            setClasses(klasses);
        }
    }

    if (classes.length === 0) {
        return <div>Loading...</div>
    }

    return (
        <>
            <ProguardUploader onUpload={handleProguardUpload} />
            <ClassTree classes={classes} dexfile={dexId} />
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
    OUTPUT.render(<App file={file} />)
}

function ClassTree({ classes, dexfile }: { classes: {obfuscated: string, original: string}[], dexfile: number }) {
    return classes.map(cls => <DexClass key={cls.obfuscated} name={cls.obfuscated} displayName={cls.original} dexfile={dexfile} />)
}


function DexClass({ name, displayName, dexfile }: { name: string, displayName: string, dexfile: number }) {
    const [expanded, setExpanded] = useState(false)
    const [methods, setMethods] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    const loadMethods = async () => {
        if (!expanded || methods.length > 0) return

        setLoading(true)
        try {
            const dextk = window['godexviewer']
            const methodNames = dextk.getMethodNames(dexfile, name)
            setMethods(methodNames)
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
                {displayName}
            </div>
            <div style={{ display: expanded ? 'block' : 'none', paddingLeft: 16 }}>
                {loading ? (
                    <div>Loading methods...</div>
                ) : (
                    methods.map(method => (
                        <DexMethod key={method} method={method} dexfile={dexfile} className={name} />
                    ))
                )}
            </div>
        </div>
    )
}

function DexMethod({ method, dexfile, className }: { method: string, dexfile: number, className: string }) {
    const [expanded, setExpanded] = useState(false)
    const [instructions, setInstructions] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    const loadInstructions = async () => {
        if (!expanded || instructions.length > 0) return

        setLoading(true)
        try {
            const dextk = window['godexviewer']
            const methodName = method.split(' ')[1].split('(')[0]
            const methodInstructions = dextk.getMethodInstructions(dexfile, className, methodName)
            setInstructions(methodInstructions)
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
                {method}
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

