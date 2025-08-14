import { createRoot } from 'react-dom/client'
import React, { useState, useEffect } from 'react'
import init, { parse_map, search_map, deobfuscate, init_logger, SearchResult } from './proguard-wasm/pkg'

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
    console.log('Proguard handleFile', file)
    await init()
    const fileBytes = await file.text()

    init_logger()

    parse_map(fileBytes)
    OUTPUT.render(<App />)
}

function App() {
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [stackTrace, setStackTrace] = useState('')
    const [deobfuscatedStackTrace, setDeobfuscatedStackTrace] = useState('')

    const handleSearch = () => {
        const results = search_map(searchTerm)
        setSearchResults(results)
    }

    const handleDeobfuscate = () => {
        const deobfuscated = deobfuscate(stackTrace)
        setDeobfuscatedStackTrace(deobfuscated)
    }

    return (
        <div>
            <h1>ProGuard Mapping Viewer</h1>
            <div>
                <h2>Search</h2>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button onClick={handleSearch}>Search</button>
                <ul>
                    {searchResults.map((result, i) => (
                        <li key={i}>
                            {result.original} -&gt; {result.obfuscated}
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <h2>Deobfuscate Stack Trace</h2>
                <textarea
                    rows={10}
                    cols={80}
                    value={stackTrace}
                    onChange={(e) => setStackTrace(e.target.value)}
                />
                <br />
                <button onClick={handleDeobfuscate}>Deobfuscate</button>
                <pre>{deobfuscatedStackTrace}</pre>
            </div>
        </div>
    )
}
