import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import * as flatbuffers from 'flatbuffers';
import ReactJson from '@microlink/react-json-view';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { RequestFileMessage, RespondFileMessage } from 'common/messages';
import { StructuralDecoder, FBNode } from './decoder';

const FlatBuffersViewer: React.FC = () => {
    const [mainFile, setMainFile] = useState<File | null>(null);
    const [mainFileData, setMainFileData] = useState<Uint8Array | null>(null);
    const [schemaFile, setSchemaFile] = useState<File | null>(null);
    const [schemaData, setSchemaData] = useState<Uint8Array | null>(null);
    const [decodedData, setDecodedData] = useState<any>(null);
    const [structuralData, setStructuralData] = useState<FBNode | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fileType, setFileType] = useState<'data' | 'schema_text' | 'schema_binary' | null>(null);

    useEffect(() => {
        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' } as RequestFileMessage, '*');
        }

        const handleMessage = async (e: MessageEvent<RespondFileMessage>) => {
            if (e.data.action === 'respondFile' && e.data.file) {
                const file = e.data.file as File;
                setMainFile(file);
                const buffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(buffer);
                setMainFileData(uint8Array);

                if (file.name.endsWith('.fbs')) {
                    setFileType('schema_text');
                } else if (file.name.endsWith('.bfbs')) {
                    setFileType('schema_binary');
                } else {
                    setFileType('data');
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleSchemaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSchemaFile(file);
            const buffer = await file.arrayBuffer();
            setSchemaData(new Uint8Array(buffer));
            setError(null);
        }
    };

    const decodeFlatBuffer = useCallback(() => {
        if (!mainFileData) return;

        try {
            // Heuristic structural decoding
            const decoder = new StructuralDecoder(mainFileData);
            const structure = decoder.decode();
            setStructuralData(structure);

            if (fileType === 'schema_binary' || (mainFile?.name.endsWith('.bfbs'))) {
                setDecodedData({ info: "This is a binary FlatBuffers schema (.bfbs). Deep inspection without the reflection schema's generated code is currently limited." });
                return;
            }

            if (schemaData) {
                setDecodedData({ info: "A binary schema was provided. Generic reflection-based decoding is not yet implemented in this viewer." });
            } else {
                // Basic heuristic: try to read the 4-byte identifier at offset 4.
                const bb = new flatbuffers.ByteBuffer(mainFileData);
                const fileIdentifier = mainFileData.length >= 8 ?
                    String.fromCharCode(mainFileData[4], mainFileData[5], mainFileData[6], mainFileData[7]) :
                    "Unknown";

                setDecodedData({
                    filename: mainFile?.name,
                    size: mainFileData.length,
                    file_identifier: fileIdentifier,
                    note: "Upload a binary schema (.bfbs) to attempt decoding."
                });
            }
        } catch (err) {
            setError(`Decoding error: ${err instanceof Error ? err.message : String(err)}`);
        }
    }, [mainFileData, schemaData, fileType, mainFile]);

    useEffect(() => {
        if (mainFileData && (fileType === 'data' || fileType === 'schema_binary')) {
            decodeFlatBuffer();
        }
    }, [mainFileData, fileType, decodeFlatBuffer]);

    if (error) {
        return <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>;
    }

    if (!mainFile) {
        return <div style={{ padding: '20px' }}>Loading file...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', boxSizing: 'border-box', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>FlatBuffers Viewer - {mainFile.name}</h2>
            </div>

            {fileType === 'schema_text' ? (
                <div style={{ flex: 1, backgroundColor: '#f5f5f5', borderRadius: '4px', overflow: 'auto' }}>
                    <h3 style={{ padding: '0 20px' }}>Schema (.fbs)</h3>
                    <SyntaxHighlighter
                        language="protobuf"
                        style={docco}
                        customStyle={{ padding: '20px' }}
                    >
                        {new TextDecoder().decode(mainFileData!)}
                    </SyntaxHighlighter>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {fileType === 'data' && (
                        <div style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                Upload Binary Schema (.bfbs) for decoding:
                            </label>
                            <input type="file" accept=".bfbs" onChange={handleSchemaUpload} />
                        </div>
                    )}

                    {schemaData ? (
                        <div style={{ flex: 1 }}>
                            <h3>Decoded Content (with Schema)</h3>
                            {decodedData ? (
                                <ReactJson
                                    src={decodedData}
                                    theme="monokai"
                                    collapsed={2}
                                    displayDataTypes={false}
                                    style={{ padding: '15px', borderRadius: '4px' }}
                                />
                            ) : (
                                <pre>Processing...</pre>
                            )}
                        </div>
                    ) : (
                        <div style={{ flex: 1 }}>
                            <h3>Structure (Schema-less)</h3>
                            {structuralData ? (
                                <ReactJson
                                    src={structuralData}
                                    theme="monokai"
                                    collapsed={3}
                                    displayDataTypes={false}
                                    name="root"
                                    style={{ padding: '15px', borderRadius: '4px' }}
                                />
                            ) : (
                                <pre>Analyzing structure...</pre>
                            )}
                        </div>
                    )}

                    <div style={{ marginTop: '20px' }}>
                        <h3>Raw Data Stats</h3>
                        <ul>
                            <li>Size: {mainFileData?.length} bytes</li>
                            <li>File Identifier: {mainFileData && mainFileData.length >= 8 ?
                                String.fromCharCode(mainFileData[4], mainFileData[5], mainFileData[6], mainFileData[7]) :
                                "None"}</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<FlatBuffersViewer />);
}
