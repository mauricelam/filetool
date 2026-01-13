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

const ROOT = createRoot(document.getElementById('root')!)

async function handleFile(file: File) {
    ROOT.render(<App file={file} />)
}

const worker = new Worker(new URL("worker.js", import.meta.url), { type: 'module' });

const TOOLS = [
    {
        name: 'sepolicy-check',
        flags: [
            { flag: '-s', label: 'Source domain' },
            { flag: '-t', label: 'Target type' },
            { flag: '-c', label: 'Class' },
            { flag: '-p', label: 'Permission' },
        ],
        defaultFlags: [],
    },
    {
        name: 'sepolicy-analyze',
        flags: [],
        defaultFlags: [],
    },
];

function App({ file }: { file: File }) {
    const [output, setOutput] = useState<string>('')
    const [selectedTool, setSelectedTool] = useState<string>('sepolicy-check');
    const [toolFlags, setToolFlags] = useState<{ [key: string]: string[] }>(
        Object.fromEntries(TOOLS.map((t) => [t.name, t.defaultFlags]))
    );
    const [args, setArgs] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        worker.onmessage = (event) => {
            if (event.data.ready) {
                runTool(selectedTool, file, toolFlags[selectedTool] || []);
            } else if (event.data.output) {
                setOutput(event.data.output);
            }
        };
    }, []);

    const runTool = async (tool: string, file: File, flags: string[] = []) => {
        setOutput(`Running ${tool} ${flags}...`);

        let command = [file.name];
        for (const flag of flags) {
            command.push(flag);
            if (args[flag]) {
                command.push(args[flag]);
            }
        }

        worker.postMessage({ file, command });
    };

    useEffect(() => {
        if (file) {
            runTool(selectedTool, file, toolFlags[selectedTool] || []);
        }
    }, [selectedTool, toolFlags, file, args]);


    const handleFlagChange = (toolName: string, flag: string, checked: boolean) => {
        setToolFlags(prev => {
            const currentFlags = prev[toolName] || [];
            const newFlags = checked
                ? [...currentFlags, flag]
                : currentFlags.filter(f => f !== flag);
            return { ...prev, [toolName]: newFlags };
        });
    };

    const handleArgChange = (flag: string, value: string) => {
        setArgs(prev => ({ ...prev, [flag]: value }));
    }

    const toolNames = TOOLS.map(t => t.name)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', gap: '20px' }}>
            <Tabs
                selectedIndex={toolNames.indexOf(selectedTool)}
                onSelect={(index) => setSelectedTool(toolNames[index])}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
                <TabList>
                    {TOOLS.map(tool => (
                        <Tab key={tool.name}>{tool.name}</Tab>
                    ))}
                </TabList>

                {TOOLS.map(tool => (
                    <TabPanel key={tool.name} style={{ height: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div>
                                {tool.flags.map(flagInfo => (
                                    <label key={flagInfo.flag} style={{ marginRight: '15px' }}>
                                        <input
                                            type="checkbox"
                                            checked={(toolFlags[tool.name] || []).includes(flagInfo.flag)}
                                            onChange={(e) => handleFlagChange(tool.name, flagInfo.flag, e.target.checked)}
                                        />
                                        {flagInfo.flag}: {flagInfo.label}
                                        <input
                                            type="text"
                                            onChange={(e) => handleArgChange(flagInfo.flag, e.target.value)}
                                            style={{ marginLeft: '5px' }}
                                        />
                                    </label>
                                ))}
                            </div>
                            <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '0 4px 4px 4px' }}>
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
                        </div>
                    </TabPanel>
                ))}
            </Tabs>
        </div>
    )
}
