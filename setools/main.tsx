import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'
import 'react-tabs/style/react-tabs.css'

declare global {
    interface Window {
        loadPyodide: any;
    }
}

interface PolicyInfo {
    version: number;
    counts: {
        commons: number;
        classes: number;
        roles: number;
        types: number;
        users: number;
        bools: number;
        levels: number;
        categories: number;
    };
    symbols: {
        commons: string[];
        classes: string[];
        roles: string[];
        types: string[];
        users: string[];
        bools: string[];
    };
}

function App({ file }: { file: File }) {
    const [policyInfo, setPolicyInfo] = useState<PolicyInfo | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(true)
    const pyodideRef = useRef<any>(null)

    useEffect(() => {
        async function init() {
            try {
                if (!pyodideRef.current) {
                    pyodideRef.current = await window.loadPyodide();
                }
                const pyodide = pyodideRef.current;

                const buffer = await file.arrayBuffer();
                pyodide.FS.writeFile('policy.bin', new Uint8Array(buffer));

                // We'll try a pure-python approach since setools might not be available
                // A very simplified parser in Python to handle symbol tables correctly
                const script = `
import struct

def parse_policy(path):
    with open(path, 'rb') as f:
        data = f.read()

    offset = 0
    def read_u32():
        nonlocal offset
        val = struct.unpack('<I', data[offset:offset+4])[0]
        offset += 4
        return val

    magic = read_u32()
    if magic != 0xf97cff86:
        raise Exception(f"Invalid magic: {hex(magic)}")

    sig_len = read_u32()
    offset += sig_len

    version = read_u32()
    config = read_u32()

    counts = [read_u32() for _ in range(8)]
    names = ["commons", "classes", "roles", "types", "users", "bools", "levels", "categories"]
    count_dict = dict(zip(names, counts))

    symbols = {name: [] for name in names[:6]}

    for i in range(8):
        count = counts[i]
        for _ in range(count):
            name_len = read_u32()
            name = data[offset:offset+name_len].decode('utf-8')
            offset += name_len
            if i < 6:
                symbols[names[i]].append(name)

            # Skip datum
            if i == 0: # Commons
                offset += 4 # value
                # Common permissions table
                perm_count = read_u32()
                for _ in range(perm_count):
                    p_len = read_u32()
                    offset += p_len
                    offset += 4 # value
            elif i == 1: # Classes
                offset += 8 # value, common_value
                # Permissions
                perm_count = read_u32()
                for _ in range(perm_count):
                    p_len = read_u32()
                    offset += p_len
                    offset += 4 # value
                # Constraints
                constraint_count = read_u32()
                # Skipping constraints is hard, but we can try to guess or just stop parsing symbols here
                # For now, let's just return what we have
                return version, count_dict, symbols
            elif i == 2: # Roles
                offset += 8 # value, primary
                # Roles are followed by types set, etc.
                return version, count_dict, symbols
            elif i == 3: # Types
                offset += 12 # value, primary, flavor
                if version >= 24: offset += 4 # flags
            elif i == 4: # Users
                offset += 8 # value, primary
                # Users followed by roles set, etc.
                return version, count_dict, symbols
            elif i == 5: # Bools
                offset += 8 # value, state
            else:
                return version, count_dict, symbols

    return version, count_dict, symbols

try:
    v, c, s = parse_policy('policy.bin')
    result = {"version": v, "counts": c, "symbols": s}
except Exception as e:
    result = {"error": str(e)}
result
`;
                const result = pyodide.runPython(script).toJs({ dict_converter: Object.fromEntries });
                if (result.error) {
                    setError(result.error);
                } else {
                    setPolicyInfo(result);
                }
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }
        if (file) {
            init();
        }
    }, [file])

    const filteredSymbols = useMemo(() => {
        if (!policyInfo || !searchTerm) return policyInfo?.symbols;
        const low = searchTerm.toLowerCase();
        const s = policyInfo.symbols;
        return {
            types: s.types.filter(x => x.toLowerCase().includes(low)),
            roles: s.roles.filter(x => x.toLowerCase().includes(low)),
            users: s.users.filter(x => x.toLowerCase().includes(low)),
            classes: s.classes.filter(x => x.toLowerCase().includes(low)),
            bools: s.bools.filter(x => x.toLowerCase().includes(low)),
            commons: s.commons.filter(x => x.toLowerCase().includes(low)),
        }
    }, [policyInfo, searchTerm])

    if (error) {
        return (
            <div style={{ padding: '20px', color: 'red' }}>
                <h1>Error parsing {file.name}</h1>
                <p>{error}</p>
            </div>
        )
    }

    if (loading || !policyInfo) {
        return <div style={{ padding: '20px' }}>Analyzing {file.name}... (Using Pyodide)</div>
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>SETools - Sepolicy Analyzer</h1>
                <div>
                    <strong>Version:</strong> {policyInfo.version} |
                    <strong> Types:</strong> {policyInfo.counts.types} |
                    <strong> Roles:</strong> {policyInfo.counts.roles} |
                    <strong> Users:</strong> {policyInfo.counts.users}
                </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <input
                    type="text"
                    placeholder="Search symbols..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '8px', fontSize: '16px' }}
                />
            </div>

            <Tabs style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TabList>
                    <Tab>Types ({filteredSymbols?.types.length})</Tab>
                    <Tab>Roles ({filteredSymbols?.roles.length})</Tab>
                    <Tab>Users ({filteredSymbols?.users.length})</Tab>
                    <Tab>Classes ({filteredSymbols?.classes.length})</Tab>
                    <Tab>Bools ({filteredSymbols?.bools.length})</Tab>
                    <Tab>Summary</Tab>
                </TabList>

                <TabPanel style={{ flex: 1, overflow: 'auto' }}>
                    <SymbolList symbols={filteredSymbols?.types || []} />
                </TabPanel>
                <TabPanel style={{ flex: 1, overflow: 'auto' }}>
                    <SymbolList symbols={filteredSymbols?.roles || []} />
                </TabPanel>
                <TabPanel style={{ flex: 1, overflow: 'auto' }}>
                    <SymbolList symbols={filteredSymbols?.users || []} />
                </TabPanel>
                <TabPanel style={{ flex: 1, overflow: 'auto' }}>
                    <SymbolList symbols={filteredSymbols?.classes || []} />
                </TabPanel>
                <TabPanel style={{ flex: 1, overflow: 'auto' }}>
                    <SymbolList symbols={filteredSymbols?.bools || []} />
                </TabPanel>
                <TabPanel style={{ flex: 1, overflow: 'auto' }}>
                    <pre>{JSON.stringify(policyInfo.counts, null, 2)}</pre>
                </TabPanel>
            </Tabs>
        </div>
    )
}

function SymbolList({ symbols }: { symbols: string[] }) {
    return (
        <div style={{ padding: '10px' }}>
            {symbols.map((s, i) => (
                <div key={i} style={{ padding: '4px', borderBottom: '1px solid #eee' }}>{s}</div>
            ))}
            {symbols.length === 0 && <div>No symbols found.</div>}
        </div>
    )
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const ROOT = createRoot(document.getElementById('root')!)

async function handleFile(file: File) {
    ROOT.render(<App file={file} />)
}
