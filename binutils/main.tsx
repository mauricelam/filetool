import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'
import 'react-tabs/style/react-tabs.css'

import AceEditor from "react-ace"
import "ace-builds/src-noconflict/ace"
import "ace-builds/src-noconflict/theme-twilight"
import "ace-builds/src-noconflict/mode-lisp"
import "ace-builds/src-noconflict/ext-searchbox"

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const ROOT = createRoot(document.getElementById('root'))

async function handleFile(file: File) {
    ROOT.render(<App file={file} />)
}

let currentWorker: Worker | null = null;

function App({ file }: { file: File }) {
    const [output, setOutput] = useState<string>('')
    const [selectedTool, setSelectedTool] = useState<string>('objdump');

    useEffect(() => {
        // Run objdump by default when file is loaded
        binutil('objdump', file);
    }, [file]);

    const binutil = async (tool: string, file: File) => {
        setSelectedTool(tool);
        currentWorker?.terminate();
        setOutput('');
        currentWorker = new Worker(new URL("worker.js", import.meta.url), { type: 'module' });
        const buffer = await file.arrayBuffer();
        currentWorker.onmessage = (e) => setOutput(prev => prev + e.data + "\n");
        currentWorker.postMessage({ action: tool, file }, [buffer]);
    };

    const tools = ['objdump', 'nm', 'strings', 'readelf', 'size'];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', gap: '20px' }}>
            <Tabs
                selectedIndex={tools.indexOf(selectedTool)}
                onSelect={(index) => {
                    const tool = tools[index];
                    binutil(tool, file);
                }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
                <TabList>
                    {tools.map(tool => (
                        <Tab key={tool}>{tool}</Tab>
                    ))}
                </TabList>

                {tools.map(tool => (
                    <TabPanel key={tool} style={{ height: '100%' }}>
                        <div style={{ height: '100%', border: '1px solid #ccc', borderRadius: '0 4px 4px 4px' }}>
                            <AceEditor
                                value={output}
                                mode="lisp"
                                theme="twilight"
                                name="output-editor"
                                editorProps={{ $blockScrolling: true }}
                                setOptions={{
                                    showLineNumbers: true,
                                    showGutter: true,
                                    readOnly: true,
                                    highlightActiveLine: false,
                                    showPrintMargin: false
                                }}
                                style={{ width: '100%', height: '100%' }}
                            />
                        </div>
                    </TabPanel>
                ))}
            </Tabs>
        </div>
    )
}
