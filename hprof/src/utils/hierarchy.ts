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

    const childrenMap = new Map<number, { target: number, field_names?: string[] }[]>();
    data.links.forEach(link => {
        const children = childrenMap.get(link.source) || [];
        children.push({ target: link.target, field_names: link.field_names });
        childrenMap.set(link.source, children);
    });

    function buildNode(nodeIdx: number): HierarchyNode {
        const node = data.nodes[nodeIdx];
        const childrenInfo = childrenMap.get(nodeIdx) || [];

        // Group children by name
        const groups = new Map<string, { nodes: number[], field_names: Set<string> }>();
        childrenInfo.forEach(info => {
            const childNode = data.nodes[info.target];
            const group = groups.get(childNode.name) || { nodes: [], field_names: new Set() };
            group.nodes.push(info.target);
            if (info.field_names) {
                info.field_names.forEach(name => group.field_names.add(name));
            }
            groups.set(childNode.name, group);
        });

        const children: HierarchyNode[] = [];
        groups.forEach((group, name) => {
            if (group.nodes.length === 1) {
                children.push(buildNode(group.nodes[0]));
            } else {
                // Aggregate multiple nodes of the same class
                let totalRetained = 0;
                let totalShallow = 0;
                const subChildren: HierarchyNode[] = [];

                group.nodes.forEach(idx => {
                    const child = buildNode(idx);
                    totalRetained += child.retained_size;
                    totalShallow += child.shallow_size;
                    if (child.children) {
                        subChildren.push(...child.children);
                    }
                });

                // Re-group combined children of the same class
                // This is a bit complex as it could lead to deep recursion or mismatch.
                // For now, let's just combine the top level and show "(N objects)".

                children.push({
                    name: `${name} (${group.nodes.length} objects)`,
                    id: null, // Grouped node has no single ID
                    parent_id: node.id,
                    retained_size: totalRetained,
                    shallow_size: totalShallow,
                    // Optional: we could merge subChildren by name here too
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
            children: children.length > 0 ? children : undefined
        };
    }

    return buildNode(0);
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
