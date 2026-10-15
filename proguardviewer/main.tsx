import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { deobfuscateStackTrace, getRules, deobfuscateClass } from './proguard';
import { MantineProvider, Button, Grid, Group, Paper, Stack, Textarea, Title } from '@mantine/core';
import { safeReadText, formatBytes } from '@filetool/common';
import '@mantine/core/styles.css';

export const ProguardViewer: React.FC = () => {
    const [mappingFile, setMappingFile] = useState<string | null>(null);
    const [userInput, setUserInput] = useState('');
    const [deobfuscatedOutput, setDeobfuscatedOutput] = useState('');
    const [rules, setRules] = useState('');
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const [totalSize, setTotalSize] = useState<number>(0);

    useEffect(() => {
        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' }, '*');
        }

        const handleMessage = async (e: MessageEvent) => {
            if (e.data && e.data.action === 'respondFile') {
                try {
                    const file = e.data.file as File;
                    const { text, isTruncated, totalSize } = await safeReadText(file);
                    setIsTruncated(isTruncated);
                    setTotalSize(totalSize);
                    setMappingFile(text);
                    const rules = await getRules(text);
                    setRules(rules);
                } catch (err: any) {
                    setError(`Error reading file: ${err?.message || err}`);
                }
            }
        };
        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const handleDeobfuscateName = async () => {
        if (!mappingFile) {
            setError('Mapping file not loaded');
            return;
        }
        setIsLoading(true);
        setError('');
        setDeobfuscatedOutput('');
        try {
            const result = await deobfuscateClass(mappingFile, userInput.trim());
            setDeobfuscatedOutput(result);
        } catch (e: any) {
            setError(`Error deobfuscating: ${e?.message ?? String(e)}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeobfuscateStackTrace = async () => {
        if (!mappingFile) {
            setError('Mapping file not loaded');
            return;
        }
        setIsLoading(true);
        setError('');
        setDeobfuscatedOutput('');
        try {
            const result = await deobfuscateStackTrace(mappingFile, userInput);
            setDeobfuscatedOutput(result);
        } catch (e: any) {
            setError(`Error deobfuscating: ${e?.message ?? String(e)}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Stack p="md">
            {isTruncated && (
                <div id="truncation-warning" style={{
                    padding: '8px 12px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    border: '1px solid #ffeeba',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontFamily: 'sans-serif'
                }}>
                    ⚠️ Mapping file is too large ({formatBytes(totalSize)}). Showing preview of loaded portion.
                </div>
            )}
            <Title order={3} align="center">Proguard Deobfuscator</Title>
            <Grid>
                <Grid.Col span={6}>
                    <Stack>
                        <Textarea
                            placeholder="Paste obfuscated class name or stack trace here"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            autosize
                            minRows={10}
                        />
                        <Group position="right">
                            <Button onClick={handleDeobfuscateName} loading={isLoading}>
                                Deobfuscate Name
                            </Button>
                            <Button onClick={handleDeobfuscateStackTrace} loading={isLoading}>
                                Deobfuscate Stack Trace
                            </Button>
                        </Group>
                    </Stack>
                </Grid.Col>
                <Grid.Col span={6}>
                    <Paper shadow="xs" p="md" withBorder>
                        <Title order={5}>Deobfuscated Output</Title>
                        {error && <div style={{ color: 'red' }}>{error}</div>}
                        <pre style={{ background: '#f4f4f4', padding: '1rem', marginTop: '1rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {deobfuscatedOutput}
                        </pre>
                    </Paper>
                </Grid.Col>
            </Grid>
            <Paper shadow="xs" p="md" mt="md" withBorder>
                <Title order={4}>Mapping Rules</Title>
                <pre style={{ background: '#f4f4f4', padding: '1rem', height: '300px', overflowY: 'auto' }}>
                    {rules}
                </pre>
            </Paper>
        </Stack>
    );
};

const container = document.getElementById('output');
if (container) {
    const root = createRoot(container);
    root.render(
        <MantineProvider withGlobalStyles withNormalizeCSS>
            <ProguardViewer />
        </MantineProvider>
    );
}
