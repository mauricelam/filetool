import { createRoot } from 'react-dom/client'
import React, { useState, useEffect } from 'react'
import init, { dex_classes, dex_methods, dex_instructions, JClass, JMethod, JInstruction, init_logger } from './dexviewer/pkg'

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const OUTPUT = createRoot(document.getElementById('output'))

async function handleFile(file: File) {
    console.log('Rust dex handleFile', file)
    await init()
    const fileBytes = new Uint8Array(await file.arrayBuffer())

    init_logger()

    const classes = dex_classes(fileBytes)
    OUTPUT.render(<ClassTree classes={classes} dexfile={fileBytes} />)
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
                {javaClass.name}
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

