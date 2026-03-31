import React, { useState, useMemo } from 'react';
import { Stack, Group, Text, Button, Box, LoadingOverlay, Select, Breadcrumbs, Anchor } from '@mantine/core';
import { SankeyData, SankeyNode, SankeyLink } from '../../hprof-wasm/pkg';
import { SankeyView } from './SankeyView';
import { SunburstView } from './SunburstView';
import { TreemapView } from './TreemapView';
import { IcicleView } from './IcicleView';

interface MemoryFlowViewProps {
    data: SankeyData | null;
    loading: boolean;
    rootId: string | null;
    depth: number;
    history: { id: string | null, name: string }[];
    onDepthChange: (depth: number) => void;
    onZoom: (id: string, name: string) => void;
    onJump: (id: string | null, index: number) => void;
    onBack: () => void;
    onReset: () => void;
    onExpandOthers: (parentId: string) => void;
}

type VisualizationType = 'sankey' | 'sunburst' | 'treemap' | 'icicle';

function groupSankeyData(data: SankeyData): SankeyData {
    if (!data.nodes.length) return data;

    const childrenMap = new Map<number, { target: number, value: number, field_names?: string[] }[]>();
    data.links.forEach(link => {
        const children = childrenMap.get(link.source) || [];
        children.push({ target: link.target, value: link.value, field_names: link.field_names });
        childrenMap.set(link.source, children);
    });

    const newNodes: SankeyNode[] = [];
    const newLinks: SankeyLink[] = [];
    const oldToNewIdx = new Map<number, number>();

    function processNode(oldIdx: number): number {
        if (oldToNewIdx.has(oldIdx)) return oldToNewIdx.get(oldIdx)!;

        const node = data.nodes[oldIdx];
        const newIdx = newNodes.length;
        oldToNewIdx.set(oldIdx, newIdx);
        newNodes.push({ ...node });

        const childrenInfo = childrenMap.get(oldIdx) || [];
        const groups = new Map<string, { nodes: number[], totalValue: number, field_names: Set<string> }>();
        childrenInfo.forEach(info => {
            const childNode = data.nodes[info.target];
            const group = groups.get(childNode.name) || { nodes: [], totalValue: 0, field_names: new Set() };
            group.nodes.push(info.target);
            group.totalValue += info.value;
            if (info.field_names) info.field_names.forEach(n => group.field_names.add(n));
            groups.set(childNode.name, group);
        });

        groups.forEach((group, name) => {
            if (group.nodes.length === 1) {
                const targetNewIdx = processNode(group.nodes[0]);
                newLinks.push({
                    source: newIdx,
                    target: targetNewIdx,
                    value: group.totalValue,
                    field_names: childrenInfo.find(i => i.target === group.nodes[0])?.field_names
                });
            } else {
                const groupedNodeIdx = newNodes.length;
                let groupRetained = 0;
                let groupShallow = 0;
                group.nodes.forEach(idx => {
                    groupRetained += data.nodes[idx].retained_size;
                    groupShallow += data.nodes[idx].shallow_size;
                });

                newNodes.push({
                    name: `${name} (${group.nodes.length} objects)`,
                    id: null,
                    parent_id: node.id,
                    retained_size: groupRetained,
                    shallow_size: groupShallow
                });

                newLinks.push({
                    source: newIdx,
                    target: groupedNodeIdx,
                    value: group.totalValue,
                    field_names: group.field_names.size > 0 ? Array.from(group.field_names) : undefined
                });

                // For simplicity, we don't recurse into grouped children's children in Sankey
                // as it's not a tree and would be hard to layout.
                // But wait, it IS a tree (dominator tree).
                // If we want it to be useful, we should probably just combine them.
            }
        });

        return newIdx;
    }

    processNode(0);
    return { nodes: newNodes, links: newLinks };
}

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
    onExpandOthers,
    onJump
}: MemoryFlowViewProps) {
    const [vizType, setVizType] = useState<VisualizationType>('sankey');

    const groupedData = useMemo(() => {
        if (!data) return null;
        if (vizType === 'sankey') return groupSankeyData(data);
        return data; // Tree views handle grouping in buildHierarchy
    }, [data, vizType]);

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
                </Group>
            </Group>
            <Box style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <LoadingOverlay visible={loading} />
                {groupedData && (
                    <>
                        {vizType === 'sankey' && <SankeyView data={groupedData} onNodeClick={onZoom} onExpandOthers={onExpandOthers} />}
                        {vizType === 'sunburst' && <SunburstView data={groupedData} onNodeClick={onZoom} onExpandOthers={onExpandOthers} />}
                        {vizType === 'treemap' && <TreemapView data={groupedData} onNodeClick={onZoom} onExpandOthers={onExpandOthers} />}
                        {vizType === 'icicle' && <IcicleView data={groupedData} onNodeClick={onZoom} onExpandOthers={onExpandOthers} />}
                    </>
                )}
            </Box>
        </Stack>
    );
}
