import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, Box, Text, Center, Loader } from '@mantine/core';
import {
    MantineReactTable,
    useMantineReactTable,
    type MRT_ColumnDef,
} from 'mantine-react-table';
import { parquetReadObjects, toJson } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import '@mantine/core/styles.css';
import 'mantine-react-table/styles.css';

interface FileData {
    data: any[];
    error: string | null;
}

let onFileLoaded: ((file: File) => void) | null = null;

const handleMessage = (e: MessageEvent) => {
    if (e.data.action === 'respondFile' && onFileLoaded) {
        onFileLoaded(e.data.file);
    }
};

window.addEventListener('message', handleMessage);

const ParquetViewer: React.FC = () => {
    const [fileState, setFileState] = useState<FileData>({ data: [], error: null });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        onFileLoaded = async (file: File) => {
            try {
                setLoading(true);
                setFileState({ data: [], error: null });
                const arrayBuffer = await file.arrayBuffer();

                const uint8Array = new Uint8Array(arrayBuffer);
                const fileWrapper = {
                    byteLength: uint8Array.byteLength,
                    slice: async (start: number, end?: number) => {
                        const s = Math.max(0, start);
                        const e = end === undefined ? uint8Array.byteLength : Math.min(uint8Array.byteLength, end);
                        const slice = uint8Array.slice(s, e);
                        return slice.buffer;
                    }
                };

                const data = await parquetReadObjects({
                    file: fileWrapper,
                    compressors
                });

                const objects = data.map(row => toJson(row));
                setFileState({ data: objects, error: null });
            } catch (err: any) {
                console.error('Failed to read parquet file:', err);
                setFileState({ data: [], error: err.message || String(err) });
            } finally {
                setLoading(false);
            }
        };

        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' }, '*');
        }

        return () => {
            onFileLoaded = null;
        };
    }, []);

    const columns = useMemo<MRT_ColumnDef<any>[]>(() => {
        if (fileState.data.length === 0) return [];
        const firstRow = fileState.data[0];
        return Object.keys(firstRow).map((key) => ({
            accessorKey: key,
            header: key,
        }));
    }, [fileState.data]);

    const table = useMantineReactTable({
        columns,
        data: fileState.data,
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
        initialState: { density: 'xs' },
    });

    if (loading) {
        return (
            <Center style={{ height: '100vh' }}>
                <Box>
                    <Loader size="xl" />
                    <Text mt="md">Loading Parquet file...</Text>
                </Box>
            </Center>
        );
    }

    if (fileState.error) {
        return (
            <Center style={{ height: '100vh' }}>
                <Text color="red">Error: {fileState.error}</Text>
            </Center>
        );
    }

    if (fileState.data.length === 0) {
        return (
            <Center style={{ height: '100vh' }}>
                <Text>No data found or file is empty.</Text>
            </Center>
        );
    }

    return (
        <Box p="md">
            <MantineReactTable table={table} />
        </Box>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <MantineProvider>
            <ParquetViewer />
        </MantineProvider>
    );
}
