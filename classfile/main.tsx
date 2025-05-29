import { createRoot } from 'react-dom/client'
import init, { parse_classfile, ParsedClass } from './classfile-wasm/pkg'
import React, { ReactElement, useState } from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs'

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
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    await init()
    const parsed = parse_classfile(fileBytes)
    OUTPUT.render(<JvmClass classContent={parsed} />);
}

type Tab = 'code' | 'cpool';

function JvmClass({ classContent }: { classContent: ParsedClass }): ReactElement {
    const [tab, setTab] = useState<Tab>('code')
    let currentTab: ReactElement;
    if (tab === 'code') {
        const codeContents = `Class File Version: ${classContent.version_major}.${classContent.version_minor}\n${classContent.description}`
        currentTab = (
            <SyntaxHighlighter language="java" style={docco}
                customStyle={{ flexBasis: 0, flexGrow: 1, overflow: 'auto', margin: 0 }}>
                {codeContents}
            </SyntaxHighlighter>
        )
    } else if (tab === 'cpool') {
        currentTab = (
            <table>
                <tbody>
                    {
                        [...classContent.constant_pool.entries()].map(([i, v]) => (
                            <tr key={i}>
                                <td style={{ background: '#ddd', margin: 1 }}>{i}</td>
                                <td style={{ background: '#ddd', margin: 1 }}><pre style={{ margin: 0 }}>{v}</pre></td>
                            </tr>
                        ))
                    }
                </tbody>
            </table>
        )
    }
    return (<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ 
            display: 'flex', 
            gap: '4px', 
            borderBottom: '1px solid #ccc',
            padding: '0 8px'
        }}>
            <button 
                onClick={() => setTab(_ => 'code')}
                style={{
                    padding: '8px 16px',
                    border: 'none',
                    background: tab === 'code' ? '#e0e0e0' : 'transparent',
                    cursor: 'pointer',
                    borderRadius: '4px 4px 0 0',
                    fontWeight: tab === 'code' ? 'bold' : 'normal',
                    borderBottom: tab === 'code' ? '3px solid #2196F3' : '3px solid transparent',
                    color: tab === 'code' ? '#2196F3' : '#666',
                    transition: 'all 0.2s ease-in-out'
                }}
            >
                Code
            </button>
            <button 
                onClick={() => setTab(_ => 'cpool')}
                style={{
                    padding: '8px 16px',
                    border: 'none',
                    background: tab === 'cpool' ? '#e0e0e0' : 'transparent',
                    cursor: 'pointer',
                    borderRadius: '4px 4px 0 0',
                    fontWeight: tab === 'cpool' ? 'bold' : 'normal',
                    borderBottom: tab === 'cpool' ? '3px solid #2196F3' : '3px solid transparent',
                    color: tab === 'cpool' ? '#2196F3' : '#666',
                    transition: 'all 0.2s ease-in-out'
                }}
            >
                Constant Pool
            </button>
        </div>
        {currentTab}
    </div>)
}
