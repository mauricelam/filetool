import React, { useState, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'
import 'react-tabs/style/react-tabs.css'

import AceEditor from "react-ace"
import "ace-builds/src-noconflict/ace"
import "ace-builds/src-noconflict/theme-twilight"
import "ace-builds/src-noconflict/mode-lisp"
import "ace-builds/src-noconflict/ext-searchbox"

/**
 * PolicyInfo: Interface for policy metadata and symbols sent from the worker.
 * nprim: Number of primary entries in the symbol table.
 */
interface PolicyInfo {
    version: number;
    counts: {
        types: number;
        roles: number;
        rules: number;
        auditallow: number;
        dontaudit: number;
        neverallow: number;
        classes: number;
        users: number;
        bools: number;
    };
    symbols: {
        types: string[];
        attributes: string[];
        roles: string[];
        classes: string[];
        users: string[];
        bools: string[];
    };
}

// Current active worker instance
let currentWorker: Worker | null = null;

/**
 * App: Main React component for the SELinux Policy Viewer.
 * This component manages the state of the loaded policy and handles user interaction.
 */
function App({ file }: { file: File }) {
    const [policyInfo, setPolicyInfo] = useState<PolicyInfo | null>(null)
    const [rules, setRules] = useState<string[]>([])
    const [auditAllowRules, setAuditAllowRules] = useState<string[]>([])
    const [dontAuditRules, setDontAuditRules] = useState<string[]>([])
    const [neverAllowRules, setNeverAllowRules] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isRegex, setIsRegex] = useState(false)
    const [loading, setLoading] = useState(true)

    // Effect to initialize the worker and load the policy file when the file prop changes.
    useEffect(() => {
        async function init() {
            try {
                setLoading(true);
                setError(null);
                // Terminate any existing worker to avoid race conditions and OOM.
                currentWorker?.terminate();

                // Create worker from worker.js (bundled from worker.ts via build.mjs)
                currentWorker = new Worker(new URL("worker.js", import.meta.url), { type: 'module' });

                const buffer = await file.arrayBuffer();

                // Listen for messages from the worker
                currentWorker.onmessage = (e) => {
                    if (e.data.error) {
                        setError(e.data.error);
                    } else if (e.data.action === 'parsed') {
                        // Metadata and initial symbols extracted
                        setPolicyInfo(e.data);
                    } else if (e.data.action === 'results') {
                        // Handle search results for different rule categories
                        if (e.data.ruleType === 'auditallow') setAuditAllowRules(e.data.results);
                        else if (e.data.ruleType === 'dontaudit') setDontAuditRules(e.data.results);
                        else if (e.data.ruleType === 'neverallow') setNeverAllowRules(e.data.results);
                        else setRules(e.data.results);
                    }
                    setLoading(false);
                }

                // Send binary policy buffer to worker for libsepol processing
                currentWorker.postMessage({ action: 'parse', buffer, fileName: file.name }, [buffer]);
            } catch (e: any) {
                setError(e.message);
                setLoading(false);
            }
        }
        if (file) {
            init();
        }
    }, [file])

    // Effect to update search results when search term or regex mode changes.
    useEffect(() => {
        if (policyInfo) {
            currentWorker?.postMessage({ action: 'search', query: searchTerm, isRegex, ruleType: 'allow' });
            currentWorker?.postMessage({ action: 'search', query: searchTerm, isRegex, ruleType: 'auditallow' });
            currentWorker?.postMessage({ action: 'search', query: searchTerm, isRegex, ruleType: 'dontaudit' });
            currentWorker?.postMessage({ action: 'search', query: searchTerm, isRegex, ruleType: 'neverallow' });
        }
    }, [searchTerm, isRegex, policyInfo]);

    // Filter symbols locally for the list tabs.
    // useMemo prevents expensive re-filtering on every render.
    const filteredSymbols = useMemo(() => {
        if (!policyInfo || !searchTerm) return policyInfo?.symbols;

        let matcher: (x: string) => boolean;

        if (isRegex) {
            try {
                // Case-insensitive regex matching for symbols.
                const regex = new RegExp(searchTerm, 'i');
                matcher = (x) => regex.test(x);
            } catch (e) {
                // Fallback to no results or everything if regex is invalid while typing.
                return {
                    types: [], attributes: [], roles: [], classes: [], users: [], bools: []
                };
            }
        } else {
            const low = searchTerm.toLowerCase();
            matcher = (x) => x && x.toLowerCase().includes(low);
        }

        const s = policyInfo.symbols;
        const filter = (arr: string[]) => (arr || []).filter(x => x && matcher(x));

        return {
            types: filter(s.types),
            attributes: filter(s.attributes),
            roles: filter(s.roles),
            classes: filter(s.classes),
            users: filter(s.users),
            bools: filter(s.bools),
        }
    }, [policyInfo, searchTerm])

    // Error state display
    if (error) {
        return (
            <div style={{ padding: '0 20px', color: 'red' }}>
                <h1>Error parsing {file.name}</h1>
                <p>{error}</p>
            </div>
        )
    }

    // Loading state display
    if (loading || !policyInfo) {
        return <div style={{ padding: '0 20px' }}>Analyzing {file.name}... (Using WASM)</div>
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0 20px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>SETools</h2>
                <div style={{ fontSize: '0.9em', color: '#666' }}>
                    <strong>Version:</strong> {policyInfo.version} |
                    <strong> Rules:</strong> {policyInfo.counts.rules} |
                    <strong> Types:</strong> {policyInfo.symbols.types.length} |
                    <strong> Attributes:</strong> {policyInfo.symbols.attributes.length}
                </div>
            </div>

            {/* Global Search Bar */}
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                    type="text"
                    placeholder="Search symbols or rules (e.g. 'untrusted_app')..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        flex: 1, padding: '12px', fontSize: '16px', borderRadius: '4px',
                        border: '1px solid #ddd', boxSizing: 'border-box'
                    }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input
                        type="checkbox"
                        checked={isRegex}
                        onChange={(e) => setIsRegex(e.target.checked)}
                    />
                    Regex
                </label>
            </div>

            {/* Tabbed interface for different policy aspects */}
            <Tabs>
                <TabList>
                    <Tab>Allow ({rules.length})</Tab>
                    <Tab>Auditallow ({auditAllowRules.length})</Tab>
                    <Tab>Dontaudit ({dontAuditRules.length})</Tab>
                    <Tab>Neverallow ({neverAllowRules.length})</Tab>
                    <Tab>Types ({filteredSymbols?.types.length || 0})</Tab>
                    <Tab>Attributes ({filteredSymbols?.attributes.length || 0})</Tab>
                    <Tab>Roles ({filteredSymbols?.roles.length || 0})</Tab>
                    <Tab>Booleans ({filteredSymbols?.bools.length || 0})</Tab>
                    <Tab>Users ({filteredSymbols?.users.length || 0})</Tab>
                    <Tab>Classes ({filteredSymbols?.classes.length || 0})</Tab>
                    <Tab>Summary</Tab>
                </TabList>

                {/* Rules Tabs: use AceEditor for large text display and search */}
                <TabPanel>
                    <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', minHeight: 0 }}>
                        <AceEditor
                            value={rules.join('\n')}
                            mode="lisp"
                            theme="twilight"
                            name="rules-editor"
                            readOnly={true}
                            style={{ width: '100%', height: '100%' }}
                            setOptions={{ useWorker: false }}
                        />
                    </div>
                </TabPanel>
                <TabPanel>
                    <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', minHeight: 0 }}>
                        <AceEditor
                            value={auditAllowRules.join('\n')}
                            mode="lisp"
                            theme="twilight"
                            name="auditallow-editor"
                            readOnly={true}
                            style={{ width: '100%', height: '100%' }}
                            setOptions={{ useWorker: false }}
                        />
                    </div>
                </TabPanel>
                <TabPanel>
                    <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', minHeight: 0 }}>
                        <AceEditor
                            value={dontAuditRules.join('\n')}
                            mode="lisp"
                            theme="twilight"
                            name="dontaudit-editor"
                            readOnly={true}
                            style={{ width: '100%', height: '100%' }}
                            setOptions={{ useWorker: false }}
                        />
                    </div>
                </TabPanel>
                <TabPanel>
                    <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', minHeight: 0 }}>
                        <AceEditor
                            value={neverAllowRules.join('\n')}
                            mode="lisp"
                            theme="twilight"
                            name="neverallow-editor"
                            readOnly={true}
                            style={{ width: '100%', height: '100%' }}
                            setOptions={{ useWorker: false }}
                        />
                    </div>
                </TabPanel>

                {/* Symbol List Tabs */}
                <TabPanel style={{ overflow: 'auto' }}>
                    <SymbolList symbols={filteredSymbols?.types || []} />
                </TabPanel>
                <TabPanel style={{ overflow: 'auto' }}>
                    <SymbolList symbols={filteredSymbols?.attributes || []} />
                </TabPanel>
                <TabPanel style={{ overflow: 'auto' }}>
                    <SymbolList symbols={filteredSymbols?.roles || []} />
                </TabPanel>
                <TabPanel style={{ overflow: 'auto' }}>
                    <SymbolList symbols={filteredSymbols?.bools || []} />
                </TabPanel>
                <TabPanel style={{ overflow: 'auto' }}>
                    <SymbolList symbols={filteredSymbols?.users || []} />
                </TabPanel>
                <TabPanel style={{ overflow: 'auto' }}>
                    <SymbolList symbols={filteredSymbols?.classes || []} />
                </TabPanel>

                {/* Metadata Summary Tab */}
                <TabPanel style={{ overflow: 'auto' }}>
                    <pre style={{ background: '#f5f5f5', padding: '15px' }}>{JSON.stringify(policyInfo.counts, null, 2)}</pre>
                </TabPanel>
            </Tabs>
        </div>
    )
}

/**
 * SymbolList: Simple component to render a list of strings efficiently.
 */
function SymbolList({ symbols }: { symbols: string[] }) {
    return (
        <div style={{ padding: '10px' }}>
            {symbols.map((s, i) => (
                <div key={i} style={{ padding: '6px', borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>{s}</div>
            ))}
            {symbols.length === 0 && <div>No symbols found.</div>}
        </div>
    )
}

// Global window message listener to receive files from the parent frame.
// This is part of the standard protocol for isolated file handlers in this repo.
window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

// Request the file from the parent frame on initialization.
if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const ROOT = createRoot(document.getElementById('root')!)

/**
 * handleFile: Entry point called when a file is received.
 */
async function handleFile(file: File) {
    ROOT.render(<App file={file} />)
}
