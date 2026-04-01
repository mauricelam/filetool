import React, { useState, useMemo } from 'react';
import { Stack, Group, Text, Button, Box, LoadingOverlay, Select, Breadcrumbs, Anchor } from '@mantine/core';
import { SankeyData, SankeyNode, SankeyLink } from '../../hprof-wasm/pkg';
import { SankeyView } from './SankeyView';
import { SunburstView } from './SunburstView';
import { TreemapView } from './TreemapView';
import { IcicleView } from './IcicleView';
import { formatBytes } from '../utils/hierarchy';

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

type VisualizationType = 'sankey' | 'sunburst' | 'treemap' | 'icicle';

export interface HoverInfo {
    title: string;
    retainedSize: number;
    shallowSize?: number;
    type: 'node' | 'link';
    targetName?: string;
    fieldNames?: string[];
    percentageOfParent?: string;
}

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
    const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

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
                    <Text size="sm">Split count:</Text>
                    <input
                        type="number"
                        value={splitCount}
                        min={1}
                        max={100}
                        onChange={(e) => onSplitCountChange(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: '50px' }}
                        aria-label="Split count"
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
                    <Box
                        p="xs"
                        bg="rgba(255, 255, 255, 0.9)"
                        style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            zIndex: 100,
                            pointerEvents: 'none',
                            maxWidth: '300px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        <Stack gap={2}>
                            {hoverInfo.type === 'node' ? (
                                <>
                                    <Text fw={700} size="sm">{hoverInfo.title}</Text>
                                    <Text size="xs">Retained: {formatBytes(hoverInfo.retainedSize)}</Text>
                                    {hoverInfo.shallowSize && hoverInfo.shallowSize > 0 && (
                                        <Text size="xs">Shallow: {formatBytes(hoverInfo.shallowSize)}</Text>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Text fw={700} size="sm">{hoverInfo.title} → {hoverInfo.targetName}</Text>
                                    {hoverInfo.fieldNames && hoverInfo.fieldNames.length > 0 && (
                                        <Text size="xs" c="dimmed">{hoverInfo.fieldNames.join(', ')}</Text>
                                    )}
                                    <Text size="xs">Retained: {formatBytes(hoverInfo.retainedSize)}</Text>
                                    {hoverInfo.percentageOfParent && (
                                        <Text size="xs">{hoverInfo.percentageOfParent}% of parent</Text>
                                    )}
                                </>
                            )}
                        </Stack>
                    </Box>
                )}
            </Box>
        </Stack>
    );
}
