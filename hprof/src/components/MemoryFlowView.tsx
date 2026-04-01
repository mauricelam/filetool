import React, { useState, useMemo } from 'react';
import { Stack, Group, Text, Button, Box, LoadingOverlay, Select, Breadcrumbs, Anchor, NumberInput, Paper } from '@mantine/core';
import { SankeyData } from '../../hprof-wasm/pkg';
import { SankeyView } from './SankeyView';
import { SunburstView } from './SunburstView';
import { TreemapView } from './TreemapView';
import { IcicleView } from './IcicleView';

interface MemoryFlowViewProps {
    data: SankeyData | null;
    loading: boolean;
    rootId: string | null;
    depth: number;
    splitCount: number;
    history: { id: string | null, name: string }[];
    onDepthChange: (depth: number) => void;
    onSplitCountChange: (count: number) => void;
    onZoom: (id: string, name: string) => void;
    onJump: (id: string | null, index: number) => void;
    onBack: () => void;
    onReset: () => void;
    onExpandOthers: (parentId: string) => void;
}

export type HoverInfo = {
    title: string;
    lines: string[];
} | null;

type VisualizationType = 'sankey' | 'sunburst' | 'treemap' | 'icicle';

export function MemoryFlowView({
    data,
    loading,
    rootId,
    depth,
    splitCount,
    history,
    onDepthChange,
    onSplitCountChange,
    onZoom,
    onBack,
    onReset,
    onExpandOthers,
    onJump
}: MemoryFlowViewProps) {
    const [vizType, setVizType] = useState<VisualizationType>('sankey');
    const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null);

    const currentName = rootId === null ? 'Root GC' : (data?.nodes.find(n => n.id === rootId)?.name || rootId);

    return (
        <Stack h="100%" gap={0}>
            <Group p="xs" justify="space-between" bg="gray.0" style={{ borderBottom: '1px solid #eee' }}>
                <Group>
                    <Select
                        size="xs"
                        aria-label="Visualization type"
                        data={[
                            { value: 'sankey', label: 'Sankey' },
                            { value: 'sunburst', label: 'Sunburst' },
                            { value: 'treemap', label: 'Treemap' },
                            { value: 'icicle', label: 'Icicle' }
                        ]}
                        value={vizType}
                        onChange={(val) => setVizType(val as VisualizationType)}
                        style={{ width: '130px' }}
                    />

                    <Breadcrumbs size="xs">
                        {history.map((item, index) => (
                            <Anchor key={index} onClick={() => onJump(item.id, index)}>
                                {item.name}
                            </Anchor>
                        ))}
                        <Text size="xs" fw={700}>{currentName}</Text>
                    </Breadcrumbs>

                    {history.length > 0 && (
                        <Button size="compact-xs" variant="subtle" onClick={onBack}>Back</Button>
                    )}
                </Group>
                <Group gap="xs">
                    <Text size="xs" fw={500}>Depth:</Text>
                    <NumberInput
                        size="xs"
                        value={depth}
                        min={1}
                        max={10}
                        onChange={(val) => onDepthChange(Number(val) || 1)}
                        style={{ width: '60px' }}
                    />
                    <Text size="xs" fw={500} ml="xs">Split count:</Text>
                    <NumberInput
                        size="xs"
                        aria-label="Split count"
                        value={splitCount}
                        min={1}
                        max={100}
                        onChange={(val) => onSplitCountChange(Number(val) || 5)}
                        style={{ width: '70px' }}
                    />
                </Group>
            </Group>
            <Box style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <LoadingOverlay visible={loading} />
                {data && (
                    <>
                        {vizType === 'sankey' && <SankeyView data={data} onNodeClick={onZoom} onExpandOthers={onExpandOthers} onHover={setHoverInfo} />}
                        {vizType === 'sunburst' && <SunburstView data={data} onNodeClick={onZoom} onExpandOthers={onExpandOthers} onHover={setHoverInfo} />}
                        {vizType === 'treemap' && <TreemapView data={data} onNodeClick={onZoom} onExpandOthers={onExpandOthers} onHover={setHoverInfo} />}
                        {vizType === 'icicle' && <IcicleView data={data} onNodeClick={onZoom} onExpandOthers={onExpandOthers} onHover={setHoverInfo} />}
                    </>
                )}
                {hoverInfo && (
                    <Paper
                        className="memory-flow-tooltip"
                        pos="absolute"
                        top={10}
                        left={10}
                        p="xs"
                        shadow="sm"
                        withBorder
                        style={{ pointerEvents: 'none', zIndex: 10, maxWidth: '300px', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                    >
                        <Text fw={700} size="sm">{hoverInfo.title}</Text>
                        {hoverInfo.lines.map((line, i) => (
                            <Text key={i} size="xs">{line}</Text>
                        ))}
                    </Paper>
                )}
            </Box>
        </Stack>
    );
}
