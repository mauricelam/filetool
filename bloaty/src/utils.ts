import React from 'react';
import * as d3 from 'd3';

export interface BloatyNode {
    name: string;
    vmsize: number;
    filesize: number;
    children?: BloatyNode[];
}

export const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    const val = (bytes / Math.pow(k, i)).toFixed(2);
    return (bytes < 0 ? '-' : '') + parseFloat(val) + ' ' + sizes[i];
};

/**
 * Parses Bloaty TSV output into a hierarchical structure.
 * Bloaty TSV for multiple domains looks like:
 * compileunits	symbols	vmsize	filesize
 * file1.cc	[vtable for Class]	100	100
 * ...
 */
export function parseBloatyTsv(tsv: string): BloatyNode {
    const lines = tsv.trim().split('\n');
    if (lines.length < 2) return { name: 'root', vmsize: 0, filesize: 0 };

    const header = lines[0].split('\t');
    const vmsizeIdx = header.indexOf('vmsize');
    const filesizeIdx = header.indexOf('filesize');
    const domainCount = vmsizeIdx; // All columns before vmsize are domains

    if (vmsizeIdx === -1 || filesizeIdx === -1) {
        return { name: 'root', vmsize: 0, filesize: 0 };
    }

    const root: BloatyNode = { name: 'root', vmsize: 0, filesize: 0, children: [] };

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length < vmsizeIdx + 2) continue;

        const vmsize = parseInt(cols[vmsizeIdx]) || 0;
        const filesize = parseInt(cols[filesizeIdx]) || 0;

        let current = root;
        for (let d = 0; d < domainCount; d++) {
            const name = cols[d] || '[unknown]';
            let child = current.children?.find(c => c.name === name);
            if (!child) {
                child = { name, vmsize: 0, filesize: 0, children: [] };
                current.children = current.children || [];
                current.children.push(child);
            }
            child.vmsize += vmsize;
            child.filesize += filesize;
            current = child;
        }
        root.vmsize += vmsize;
        root.filesize += filesize;
    }

    // Recursively remove empty children arrays to make it a proper d3 hierarchy
    const clean = (node: BloatyNode) => {
        if (node.children && node.children.length === 0) {
            delete node.children;
        } else if (node.children) {
            node.children.forEach(clean);
        }
    };
    clean(root);

    return root;
}
