import React, { useState } from 'react';
import { Stack, Group, Text, Button, Box, LoadingOverlay, Select } from '@mantine/core';
import { SankeyData } from '../../hprof-wasm/pkg';
import { SankeyView } from './SankeyView';
import { SunburstView } from './SunburstView';
import { TreemapView } from './TreemapView';
import { IcicleView } from './IcicleView';
import { CirclePackingView } from './CirclePackingView';

interface MemoryFlowViewProps {
    data: SankeyData | null;
    loading: boolean;
    rootId: string | null;
    depth: number;
    history: (string | null)[];
    onDepthChange: (depth: number) => void;
    onZoom: (id: string) => void;
    onBack: () => void;
    onReset: () => void;
    onExpandOthers: (parentId: string) => void;
}

type VisualizationType = 'sankey' | 'sunburst' | 'treemap' | 'icicle' | 'circlepacking';

export function MemoryFlowView({
    data,
    loading,
    rootId,
    depth,
    history,
    onDepthChange,
    onZoom,
    onBack,
    onReset,
    onExpandOthers
}: MemoryFlowViewProps) {
    const [vizType, setVizType] = useState<VisualizationType>('sankey');

    return (
        <Stack h="100%" gap={0}>
            <Group p="xs" justify="space-between" bg="gray.0" style={{ borderBottom: '1px solid #eee' }}>
                <Group>
                    <Select
                        size="xs"
                        data={[
                            { value: 'sankey', label: 'Sankey' },
                            { value: 'sunburst', label: 'Sunburst' },
                            { value: 'treemap', label: 'Treemap' },
                            { value: 'icicle', label: 'Icicle' },
                            { value: 'circlepacking', label: 'Circle Packing' }
                        ]}
                        value={vizType}
                        onChange={(val) => setVizType(val as VisualizationType)}
                        style={{ width: '130px' }}
                    />
                    <Text fw={700} size="sm">
                        {rootId ? `(Zoomed: ${rootId})` : '(Root GC)'}
                    </Text>
                    {history.length > 0 && (
                        <Button size="compact-xs" variant="subtle" onClick={onBack}>Back</Button>
                    )}
                    {rootId && (
                        <Button size="compact-xs" variant="light" onClick={onReset}>Reset Zoom</Button>
                    )}
                </Group>
                <Group>
                    <Text size="sm">Depth:</Text>
                    <input
                        type="number"
                        value={depth}
                        min={1}
                        max={10}
                        onChange={(e) => onDepthChange(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: '50px' }}
                    />
                </Group>
            </Group>
            <Box style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <LoadingOverlay visible={loading} />
                {data && (
                    <>
                        {vizType === 'sankey' && <SankeyView data={data} onNodeClick={onZoom} onExpandOthers={onExpandOthers} />}
                        {vizType === 'sunburst' && <SunburstView data={data} onNodeClick={onZoom} onExpandOthers={onExpandOthers} />}
                        {vizType === 'treemap' && <TreemapView data={data} onNodeClick={onZoom} onExpandOthers={onExpandOthers} />}
                        {vizType === 'icicle' && <IcicleView data={data} onNodeClick={onZoom} onExpandOthers={onExpandOthers} />}
                        {vizType === 'circlepacking' && <CirclePackingView data={data} onNodeClick={onZoom} onExpandOthers={onExpandOthers} />}
                    </>
                )}
            </Box>
        </Stack>
    );
}
