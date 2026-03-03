import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, Box, Text, Center, Loader } from '@mantine/core';
import {
    MantineReactTable,
    useMantineReactTable,
    type MRT_ColumnDef,
} from 'mantine-react-table';
import { parquetRead, parquetSchema, toJson, parquetMetadata } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import '@mantine/core/styles.css';
import 'mantine-react-table/styles.css';

const ParquetViewer: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                const file: File = e.data.file;
                try {
                    setLoading(true);
                    setError(null);
                    const arrayBuffer = await file.arrayBuffer();

                    const uint8Array = new Uint8Array(arrayBuffer);
                    const fileWrapper = {
                        byteLength: uint8Array.byteLength,
                        request: async (offset: number, length: number) => uint8Array.subarray(offset, offset + length)
                    };

                    const metadata = parquetMetadata(arrayBuffer);
                    const schema = parquetSchema(metadata);
                    // schema[0] is root, schema[1..n] are columns
                    const columnNames = schema.slice(1).map(s => s.element.name);

                    await parquetRead({
                        file: fileWrapper,
                        metadata,
                        compressors,
                        onComplete: (rows) => {
                            const objects = rows.map(row => {
                                const obj: any = {};
                                columnNames.forEach((name, i) => {
                                    obj[name] = row[i];
                                });
                                return toJson(obj);
                            });
                            setData(objects);
                        }
                    });
                } catch (err: any) {
                    console.error('Failed to read parquet file:', err);
                    setError(err.message || String(err));
                } finally {
                    setLoading(false);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' }, '*');
        }

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const columns = useMemo<MRT_ColumnDef<any>[]>(() => {
        if (data.length === 0) return [];
        const firstRow = data[0];
        return Object.keys(firstRow).map((key) => ({
            accessorKey: key,
            header: key,
        }));
    }, [data]);

    const table = useMantineReactTable({
        columns,
        data,
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
        initialState: { density: 'compact' },
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

    if (error) {
        return (
            <Center style={{ height: '100vh' }}>
                <Text color="red">Error: {error}</Text>
            </Center>
        );
    }

    if (data.length === 0) {
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
