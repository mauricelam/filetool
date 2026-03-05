import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import * as flatbuffers from 'flatbuffers';
import ReactJson from '@microlink/react-json-view';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { RequestFileMessage, RespondFileMessage } from 'common/messages';
import { StructuralDecoder, FBNode } from './decoder';
import { AnnotatedDecoder } from './annotated';
import { decodeReflectionSchema, decodeWithSchema } from './reflection';

const Tab: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <div
        onClick={onClick}
        style={{
            padding: '8px 16px',
            cursor: 'pointer',
            borderBottom: active ? '2px solid #007bff' : '2px solid transparent',
            color: active ? '#007bff' : '#666',
            fontWeight: active ? 'bold' : 'normal',
            transition: 'all 0.2s'
        }}
    >
        {label}
    </div>
);

const SchemaUpload: React.FC<{ onUpload: (file: File) => void }> = ({ onUpload }) => {
    const fileInput = React.useRef<HTMLInputElement>(null);
    const [isDropOver, setDropOver] = useState(false);

    const handleDrop = async (e: React.DragEvent) => {
        setDropOver(false);
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.name.endsWith('.bfbs')) {
            onUpload(file);
        }
    };

    return (
        <div
            onClick={() => fileInput.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDropOver(true); }}
            onDragLeave={() => setDropOver(false)}
            style={{
                border: `1px dashed ${isDropOver ? '#007bff' : '#ccc'}`,
                borderRadius: '4px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: isDropOver ? '#f0f7ff' : '#f8f9fa',
                fontSize: '13px',
                transition: 'all 0.2s'
            }}
        >
            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#666">
                <path d="M440-320h80v-167l64 64 56-57-160-160-160 160 57 56 63-63v167ZM240-160q-33 0-56.5-23.5T160-240v-480q0-33 23.5-56.5T240-800h480q33 0 56.5 23.5T800-720v480q0 33-23.5 56.5T720-160H240Zm0-80h480v-480H240v480Zm0 0v-480 480Z" />
            </svg>
            <span style={{ color: '#444' }}>Drop .bfbs schema here</span>
            <input
                type="file"
                accept=".bfbs"
                ref={fileInput}
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
        </div>
    );
};

const FlatBuffersViewer: React.FC = () => {
    const [mainFile, setMainFile] = useState<File | null>(null);
    const [mainFileData, setMainFileData] = useState<Uint8Array | null>(null);
    const [schemaFile, setSchemaFile] = useState<File | null>(null);
    const [schemaData, setSchemaData] = useState<Uint8Array | null>(null);
    const [decodedData, setDecodedData] = useState<any>(null);
    const [structuralData, setStructuralData] = useState<FBNode | null>(null);
    const [annotatedText, setAnnotatedText] = useState<string | null>(null);
    type ViewMode = 'decoded' | 'structural' | 'extended' | 'stats' | 'source';
    const [viewMode, setViewMode] = useState<ViewMode>('structural');
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
                    setViewMode('source');
                } else if (file.name.endsWith('.bfbs')) {
                    setFileType('schema_binary');
                    setViewMode('decoded');
                } else {
                    setFileType('data');
                    setViewMode('structural');
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleSchemaUpload = async (file: File) => {
        setSchemaFile(file);
        const buffer = await file.arrayBuffer();
        setSchemaData(new Uint8Array(buffer));
        setViewMode('decoded');
        setError(null);
    };

    const decodeFlatBuffer = useCallback(() => {
        if (!mainFileData) return;

        try {
            // Heuristic structural decoding
            const decoder = new StructuralDecoder(mainFileData);
            const structure = decoder.decode();
            setStructuralData(structure);

            // Annotated decoding for extended view
            const annotatedDecoder = new AnnotatedDecoder(mainFileData);
            const annotated = annotatedDecoder.decode();
            setAnnotatedText(annotated);

            if (fileType === 'schema_binary' || (mainFile?.name.endsWith('.bfbs'))) {
                try {
                    const schemaData = decodeReflectionSchema(mainFileData);
                    setDecodedData(schemaData);
                    setSchemaData(mainFileData); // Treat as own schema
                } catch (e) {
                    setDecodedData({ info: "This is a binary FlatBuffers schema (.bfbs). Failed to decode using reflection: " + e });
                }
                return;
            }

            if (schemaData) {
                try {
                    const result = decodeWithSchema(mainFileData, schemaData);
                    setDecodedData(result);
                } catch (e) {
                    setDecodedData({ info: "A binary schema was provided, but decoding failed: " + e });
                }
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '20px' }}>
                <h2 style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    FlatBuffers Viewer - {mainFile.name}
                </h2>
                {fileType === 'data' && <SchemaUpload onUpload={handleSchemaUpload} />}
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '20px' }}>
                {fileType === 'schema_text' ? (
                    <>
                        <Tab label="Source" active={viewMode === 'source'} onClick={() => setViewMode('source')} />
                        <Tab label="Raw Stats" active={viewMode === 'stats'} onClick={() => setViewMode('stats')} />
                    </>
                ) : (
                    <>
                        {(schemaData || fileType === 'schema_binary') && (
                            <Tab label="Decoded" active={viewMode === 'decoded'} onClick={() => setViewMode('decoded')} />
                        )}
                        <Tab label="Structural Tree" active={viewMode === 'structural'} onClick={() => setViewMode('structural')} />
                        <Tab label="Extended View" active={viewMode === 'extended'} onClick={() => setViewMode('extended')} />
                        <Tab label="Raw Stats" active={viewMode === 'stats'} onClick={() => setViewMode('stats')} />
                    </>
                )}
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
                {viewMode === 'source' && (
                    <div style={{ backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <SyntaxHighlighter
                            language="protobuf"
                            style={docco}
                            customStyle={{ padding: '20px' }}
                        >
                            {new TextDecoder().decode(mainFileData!)}
                        </SyntaxHighlighter>
                    </div>
                )}

                {viewMode === 'decoded' && (
                    <div style={{ flex: 1 }}>
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
                )}

                {viewMode === 'structural' && (
                    <div style={{ flex: 1 }}>
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

                {viewMode === 'extended' && (
                    <div style={{ flex: 1 }}>
                        {annotatedText ? (
                            <pre style={{
                                backgroundColor: '#f5f5f5',
                                padding: '20px',
                                borderRadius: '4px',
                                overflowX: 'auto',
                                fontFamily: 'monospace',
                                fontSize: '14px',
                                lineHeight: '1.4'
                            }}>
                                {annotatedText}
                            </pre>
                        ) : (
                            <pre>Generating extended view...</pre>
                        )}
                    </div>
                )}

                {viewMode === 'stats' && (
                    <div style={{ padding: '0 20px' }}>
                        <ul style={{ lineHeight: '2' }}>
                            <li><strong>Size:</strong> {mainFileData?.length} bytes</li>
                            <li><strong>File Identifier:</strong> {mainFileData && mainFileData.length >= 8 ?
                                String.fromCharCode(mainFileData[4], mainFileData[5], mainFileData[6], mainFileData[7]) :
                                "None"}</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<FlatBuffersViewer />);
}
