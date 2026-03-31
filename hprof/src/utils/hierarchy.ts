import { SankeyData } from '../../hprof-wasm/pkg';

export interface HierarchyNode {
    name: string;
    id: string | null;
    parent_id: string | null;
    retained_size: number;
    shallow_size: number;
    children?: HierarchyNode[];
    value?: number; // For d3 layouts
}

export function buildHierarchy(data: SankeyData): HierarchyNode | null {
    if (!data.nodes || data.nodes.length === 0) return null;

    const childrenMap = new Map<number, number[]>();
    data.links.forEach(link => {
        const children = childrenMap.get(link.source) || [];
        children.push(link.target);
        childrenMap.set(link.source, children);
    });

    function buildNode(nodeIdx: number): HierarchyNode {
        const node = data.nodes[nodeIdx];
        const childrenIdxs = childrenMap.get(nodeIdx) || [];
        const children = childrenIdxs.map(buildNode);

        return {
            name: node.name,
            id: node.id,
            parent_id: node.parent_id,
            retained_size: node.retained_size,
            shallow_size: node.shallow_size,
            children: children.length > 0 ? children : undefined
        };
    }

    return buildNode(0);
}

export const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
