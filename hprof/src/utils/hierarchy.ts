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

    const childrenMap = new Map<number, { target: number, value: number, field_names?: string[] }[]>();
    data.links.forEach(link => {
        const children = childrenMap.get(link.source) || [];
        children.push({ target: link.target, value: link.value, field_names: link.field_names });
        childrenMap.set(link.source, children);
    });

    function buildNode(nodeIdx: number, value: number): HierarchyNode {
        const node = data.nodes[nodeIdx];
        const childrenInfo = childrenMap.get(nodeIdx) || [];

        // Group children by name
        const groups = new Map<string, { targets: { idx: number, val: number }[], field_names: Set<string> }>();
        childrenInfo.forEach(info => {
            const childNode = data.nodes[info.target];
            const group = groups.get(childNode.name) || { targets: [], field_names: new Set() };
            group.targets.push({ idx: info.target, val: info.value });
            if (info.field_names) {
                info.field_names.forEach(name => group.field_names.add(name));
            }
            groups.set(childNode.name, group);
        });

        const children: HierarchyNode[] = [];
        groups.forEach((group, name) => {
            if (group.targets.length === 1) {
                children.push(buildNode(group.targets[0].idx, group.targets[0].val));
            } else {
                let totalRetained = 0;
                let totalShallow = 0;
                let totalValue = 0;
                const subChildren: HierarchyNode[] = [];

                group.targets.forEach(t => {
                    const child = buildNode(t.idx, t.val);
                    totalRetained += child.retained_size;
                    totalShallow += child.shallow_size;
                    totalValue += (child.value || 0);
                    if (child.children) {
                        subChildren.push(...child.children);
                    }
                });

                children.push({
                    name: `${name} (${group.targets.length} objects)`,
                    id: null,
                    parent_id: node.id,
                    retained_size: totalRetained,
                    shallow_size: totalShallow,
                    value: totalValue,
                    children: subChildren.length > 0 ? mergeSiblings(subChildren) : undefined
                });
            }
        });

        return {
            name: node.name,
            id: node.id,
            parent_id: node.parent_id,
            retained_size: node.retained_size,
            shallow_size: node.shallow_size,
            value: value,
            children: children.length > 0 ? children : undefined
        };
    }

    return buildNode(0, data.nodes[0].retained_size);
}

function mergeSiblings(nodes: HierarchyNode[]): HierarchyNode[] {
    const groups = new Map<string, HierarchyNode[]>();
    nodes.forEach(node => {
        // Strip "(N objects)" if it's already there to merge properly
        const baseName = node.name.replace(/ \(\d+ objects\)$/, "");
        const group = groups.get(baseName) || [];
        group.push(node);
        groups.set(baseName, group);
    });

    const result: HierarchyNode[] = [];
    groups.forEach((group, name) => {
        if (group.length === 1) {
            result.push(group[0]);
        } else {
            let totalRetained = 0;
            let totalShallow = 0;
            const subChildren: HierarchyNode[] = [];
            group.forEach(n => {
                totalRetained += n.retained_size;
                totalShallow += n.shallow_size;
                if (n.children) subChildren.push(...n.children);
            });
            result.push({
                name: `${name} (${group.reduce((acc, n) => {
                    const m = n.name.match(/ \((\d+) objects\)$/);
                    return acc + (m ? parseInt(m[1]) : 1);
                }, 0)} objects)`,
                id: null,
                parent_id: group[0].parent_id,
                retained_size: totalRetained,
                shallow_size: totalShallow,
                children: subChildren.length > 0 ? mergeSiblings(subChildren) : undefined
            });
        }
    });
    return result;
}

export const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
