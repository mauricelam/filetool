import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { deobfuscateStackTrace, getRules, deobfuscateClass } from './proguard';
import { MantineProvider, Button, Grid, Group, Paper, Stack, Textarea, Title } from '@mantine/core';
import '@mantine/core/styles.css';

// Request file from parent window
if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' });
}

const ProguardViewer: React.FC = () => {
    const [mappingFile, setMappingFile] = useState<string | null>(null);
    const [userInput, setUserInput] = useState('');
    const [deobfuscatedOutput, setDeobfuscatedOutput] = useState('');
    const [rules, setRules] = useState('');
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                try {
                    const file = e.data.file as File;
                    const text = await file.text();
                    setMappingFile(text);
                    const rules = await getRules(text);
                    setRules(rules);
                } catch (err) {
                    setError(`Error reading file: ${err.message}`);
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
