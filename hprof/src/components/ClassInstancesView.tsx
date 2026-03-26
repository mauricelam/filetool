import React, { useState, useEffect } from 'react'
import { Box, LoadingOverlay, Stack, Group, Button, Text } from '@mantine/core'
import { HprofParser } from '../../hprof-wasm/pkg'

interface ClassInstancesViewProps {
    parser: HprofParser
    classId: string
    className: string
    onSelectInstance: (id: string) => void
    onBack: () => void
}

export function ClassInstancesView({ parser, classId, className, onSelectInstance, onBack }: ClassInstancesViewProps) {
    const [instances, setInstances] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [offset, setOffset] = useState(0);
    const limit = 100;

    useEffect(() => {
        setLoading(true);
        setTimeout(() => {
            try { setInstances(parser.get_class_instances(classId, offset, limit)) }
            catch (e) { console.error(e) }
            finally { setLoading(false) }
        }, 0);
    }, [classId, offset, parser]);

    return (
        <Stack p="md" h="100%">
            <Group><Button onClick={onBack} variant="subtle">← Back to Classes</Button></Group>
            <Text size="lg" fw={700}>Instances of {className}</Text>
            <Box style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                <LoadingOverlay visible={loading} />
                <Stack gap="xs">
                    {instances.map(id => (
                        <Box key={id} onClick={() => onSelectInstance(id)} className="clickable-row" p="sm" style={{ border: '1px solid #eee', cursor: 'pointer', borderRadius: '4px', background: '#fff' }}>
                            <Text>{id}</Text>
                        </Box>
                    ))}
                    {!loading && !instances.length && <Text c="dimmed">No instances found in this range.</Text>}
                </Stack>
            </Box>
            <Group>
                <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</Button>
                <Button disabled={instances.length < limit} onClick={() => setOffset(offset + limit)}>Next</Button>
            </Group>
        </Stack>
    );
}
