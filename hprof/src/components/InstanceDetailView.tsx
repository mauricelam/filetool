import React, { useState, useEffect } from 'react'
import { Box, LoadingOverlay, Stack, Group, Button, Text, Table } from '@mantine/core'
import { HprofParser, InstanceInfo } from '../../hprof-wasm/pkg'

interface InstanceDetailViewProps {
    parser: HprofParser
    instanceId: string
    onSelectInstance: (id: string) => void
    onBack: () => void
}

export function InstanceDetailView({ parser, instanceId, onSelectInstance, onBack }: InstanceDetailViewProps) {
    const [info, setInfo] = useState<InstanceInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [retainedSize, setRetainedSize] = useState<number | null>(null);
    const [calculatingRetained, setCalculatingRetained] = useState(false);
    const [gcPaths, setGcPaths] = useState<string[][] | null>(null);
    const [findingGc, setFindingGc] = useState(false);

    useEffect(() => {
        setLoading(true); setRetainedSize(null); setGcPaths(null);
        setTimeout(() => {
            try {
                setInfo(parser.get_instance_info(instanceId));
                // Automatically trigger calculations for detail view
                calculateRetained();
                findGcPaths(false);
            }
            catch (e) { console.error(e) }
            finally { setLoading(false) }
        }, 0);
    }, [instanceId, parser]);

    const calculateRetained = () => {
        setCalculatingRetained(true);
        setTimeout(() => {
            try { setRetainedSize(Number(parser.calculate_retained_size(instanceId))) }
            catch (e) { console.error(e) }
            finally { setCalculatingRetained(false) }
        }, 0);
    };

    const findGcPaths = (all: boolean) => {
        setFindingGc(true);
        setTimeout(() => {
            try {
                const res = all ? parser.get_all_paths_to_gc_root(instanceId, 5) : parser.get_shortest_path_to_gc_root(instanceId);
                if (all) {
                    setGcPaths(res || []);
                } else {
                    setGcPaths(prev => {
                        if (prev && prev.length > 0) {
                            // If we already have paths, merging might be tricky, but here we replace or just keep existing if it's already "all"
                            return res || [];
                        }
                        return res || [];
                    });
                }
            } catch (e) { console.error(e); setGcPaths(null); }
            finally { setFindingGc(false) }
        }, 0);
    };

    if (loading) return <Box h={300} pos="relative"><LoadingOverlay visible={true} /></Box>;
    if (!info) return <Text p="md">Instance not found.</Text>;

    return (
        <Stack p="md" h="100%" style={{ overflowY: 'auto' }}>
            <Group><Button onClick={onBack} variant="subtle">← Back</Button></Group>
            <Text size="lg" fw={700}>Instance Detail: {info.class_name}</Text>
            <Text size="xs" c="dimmed">ID: {info.id}</Text>

            <Group align="stretch">
                <Box style={{ flex: 1, padding: '15px', background: '#f9f9f9', borderRadius: '4px', border: '1px solid #ddd' }}>
                    <Text fw={700} mb="xs">Memory Usage</Text>
                    <Text>Shallow Size: <b>{info.size.toLocaleString()} bytes</b></Text>
                    <Group mt="xs" gap="xs">
                        <Text>Retained Size: {retainedSize !== null ? <b>{retainedSize.toLocaleString()} bytes</b> : <Button size="compact-xs" onClick={calculateRetained} loading={calculatingRetained}>Calculate</Button>}</Text>
                    </Group>
                </Box>
                <Box style={{ flex: 1, padding: '15px', background: '#f9f9f9', borderRadius: '4px', border: '1px solid #ddd' }}>
                    <Text fw={700} mb="xs">GC Roots</Text>
                    <Box pos="relative" mih={40}>
                        <LoadingOverlay visible={findingGc} overlayProps={{ blur: 1 }} loaderProps={{ size: 'xs' }} />
                        {gcPaths !== null ? (
                            gcPaths.length > 0 ? (
                                <Stack gap="xs">
                                    {gcPaths.map((path, pi) => (
                                        <Box key={pi} p="xs" style={{ borderBottom: pi < gcPaths.length - 1 ? '1px dashed #ccc' : 'none' }}>
                                            <Text size="xs" c="dimmed">Path {pi + 1}:</Text>
                                            {path.map((step, i) => <Text key={i} size="sm" ml={i * 10}>{i > 0 && <span style={{ color: '#999' }}>↳</span>} {step}</Text>)}
                                        </Box>
                                    ))}
                                    {gcPaths.length === 1 && (
                                        <Button variant="subtle" size="compact-xs" fullWidth onClick={() => findGcPaths(true)}>
                                            Find all paths to GC root
                                        </Button>
                                    )}
                                </Stack>
                            ) : <Text c="dimmed">No path to GC root found.</Text>
                        ) : null}
                    </Box>
                </Box>
            </Group>

            <Text fw={700} mt="md">Fields</Text>
            <Table>
                <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Type</Table.Th><Table.Th>Value</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                    {info.fields.map((f, i) => (
                        <Table.Tr key={i}>
                            <Table.Td>{f.name}</Table.Td>
                            <Table.Td><Text size="xs" c="dimmed">{f.ftype}</Text></Table.Td>
                            <Table.Td>{f.ref_id ? <Text c="blue" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onSelectInstance(f.ref_id!)}>{f.value}</Text> : f.value}</Table.Td>
                        </Table.Tr>
                    ))}
                    {!info.fields.length && <Table.Tr><Table.Td colSpan={3} ta="center" c="dimmed">No object fields found.</Table.Td></Table.Tr>}
                </Table.Tbody>
            </Table>
        </Stack>
    );
}
