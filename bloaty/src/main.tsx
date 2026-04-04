import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MantineProvider,
  Container,
  Title,
  Button,
  Tabs,
  Paper,
  Text,
  Group,
  Stack,
  ScrollArea,
  MultiSelect,
  Switch
} from '@mantine/core';
import { IconFileText, IconLayout2 } from '@tabler/icons-react';
import { parseBloatyTsv, formatBytes } from './utils';
import { TreemapView } from './TreemapView';
import '@mantine/core/styles.css';

const DATA_SOURCES = [
  { value: 'sections', label: 'Sections' },
  { value: 'symbols', label: 'Symbols' },
  { value: 'compileunits', label: 'Compile Units' },
  { value: 'segments', label: 'Segments' },
  { value: 'inlines', label: 'Inlines' },
  { value: 'arm_attributes', label: 'ARM Attributes' },
];

function App() {
  const [file, setFile] = useState<{ name: string, buffer: ArrayBuffer } | null>(null);
  const [dataSources, setDataSources] = useState<string[]>(['sections']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [tsvResult, setTsvResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('text');
  const [sizeType, setSizeType] = useState<'vmsize' | 'filesize'>('filesize');

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Standard worker initialization for this repo
    workerRef.current = new Worker(new URL('worker.js', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e) => {
      const { action, text, tsv, error } = e.data;
      if (action === 'result') {
        setResult(text);
        setTsvResult(tsv);
        setLoading(false);
      } else if (action === 'error') {
        setError(error);
        setLoading(false);
      }
    };

    // Listen for file from parent
    const onMessage = (e: MessageEvent) => {
      if (e.data.action === 'respondFile') {
        const fileObj = e.data.file as File;
        fileObj.arrayBuffer().then(buffer => {
          setFile({ name: fileObj.name, buffer });
        });
      }
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ action: 'requestFile' }, '*');

    return () => {
      workerRef.current?.terminate();
      window.removeEventListener('message', onMessage);
    };
  }, []);

  useEffect(() => {
    if (file) {
      runBloaty();
    }
  }, [file]);

  const runBloaty = () => {
    if (!file || !workerRef.current) return;

    setLoading(true);
    setResult('');
    setTsvResult('');
    setError(null);

    workerRef.current.postMessage({
      action: 'run',
      buffer: file.buffer,
      fileName: file.name,
      dataSources,
    });
  };

  const bloatyHierarchy = tsvResult ? parseBloatyTsv(tsvResult) : null;

  return (
    <MantineProvider>
      <Container size="xl" py="md" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Paper p="md" mb="md" withBorder shadow="sm">
          <Group justify="space-between" align="flex-end">
            <Stack gap="xs" style={{ flexGrow: 1 }}>
              <Title order={2}>Bloaty Size Profiler</Title>
              {file && (
                <Text size="sm" c="dimmed">
                  File: <strong>{file.name}</strong> ({formatBytes(file.buffer.byteLength)})
                </Text>
              )}
            </Stack>
            <Group align="flex-end">
              <MultiSelect
                label="Data Sources"
                placeholder="Select sources"
                data={DATA_SOURCES}
                value={dataSources}
                onChange={setDataSources}
                style={{ width: 300 }}
              />
              <Button onClick={runBloaty} loading={loading} disabled={!file}>
                Run Bloaty
              </Button>
            </Group>
          </Group>
        </Paper>

        {error && (
          <Paper p="md" mb="md" bg="red.0" withBorder style={{ borderColor: 'red' }}>
            <Text c="red" fw={500}>Error: {error}</Text>
          </Paper>
        )}

        <Tabs value={activeTab} onChange={setActiveTab} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <Tabs.List mb="md">
            <Tabs.Tab value="text" leftSection={<IconFileText size={16} />}>Text Output</Tabs.Tab>
            <Tabs.Tab value="treemap" leftSection={<IconLayout2 size={16} />}>Treemap</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="text" style={{ flexGrow: 1, position: 'relative' }}>
            <Paper p="md" withBorder shadow="xs" style={{ height: '100%', backgroundColor: '#1e1e1e' }}>
              <ScrollArea style={{ height: '100%' }}>
                <Text component="pre" data-testid="bloaty-output" style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', color: '#d4d4d4', whiteSpace: 'pre-wrap' }}>
                  {loading ? 'Analyzing...' : result || 'No results yet.'}
                </Text>
              </ScrollArea>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="treemap" style={{ flexGrow: 1, position: 'relative' }}>
            <Paper p="md" withBorder shadow="xs" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Group mb="md" justify="flex-end">
                <Switch
                  label={sizeType === 'vmsize' ? 'VM Size' : 'File Size'}
                  checked={sizeType === 'vmsize'}
                  onChange={(event) => setSizeType(event.currentTarget.checked ? 'vmsize' : 'filesize')}
                />
              </Group>
              <div style={{ flexGrow: 1, minHeight: 0, position: 'relative' }}>
                {bloatyHierarchy && <TreemapView data={bloatyHierarchy} sizeType={sizeType} />}
              </div>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Container>
    </MantineProvider>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
