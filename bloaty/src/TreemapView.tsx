import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { BloatyNode, formatBytes } from './utils';

interface TreemapViewProps {
    data: BloatyNode;
    sizeType: 'vmsize' | 'filesize';
}

export function TreemapView({ data, sizeType }: TreemapViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data) return;

        const width = svgRef.current.parentElement?.clientWidth || 800;
        const height = svgRef.current.parentElement?.clientHeight || 600;

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height)
            .style('font', '10px sans-serif');

        svg.selectAll('*').remove();

        const root = d3.hierarchy(data)
            .eachBefore(d => { d.data.name = (d.data.name || '').toString(); })
            .sum(d => Math.max(0, d[sizeType] || 0))
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        d3.treemap<BloatyNode>()
            .size([width, height])
            .paddingOuter(3)
            .paddingTop(19)
            .paddingInner(1)
            .round(true)
            (root);

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        const leaf = svg.selectAll('g')
            .data(root.leaves())
            .join('g')
            .attr('transform', d => `translate(${(d as any).x0},${(d as any).y0})`);

        leaf.append('rect')
            .attr('fill', d => {
                let curr = d;
                while (curr.depth > 1) curr = curr.parent!;
                return color(curr.data.name);
            })
            .attr('fill-opacity', 0.6)
            .attr('width', d => Math.max(0, (d as any).x1 - (d as any).x0))
            .attr('height', d => Math.max(0, (d as any).y1 - (d as any).y0))
            .append('title')
            .text(d => `${d.ancestors().reverse().map(d => d.data.name).join('/')}\n${formatBytes(d.value || 0)}`);

        leaf.append('text')
            .attr('clip-path', d => `inset(0 0 0 0)`)
            .selectAll('tspan')
            .data(d => d.data.name.split(/(?=[A-Z][a-z])|\s+/g).concat(formatBytes(d.value || 0)))
            .join('tspan')
            .attr('x', 3)
            .attr('y', (d, i, nodes) => `${(i === nodes.length - 1) ? 23 : 13 + i * 10}px`)
            .attr('fill-opacity', (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
            .text(d => d);

        // Add parent titles
        svg.selectAll('text.parent')
            .data(root.descendants().filter(d => d.depth > 0 && d.children))
            .join('text')
            .attr('class', 'parent')
            .attr('x', d => (d as any).x0 + 3)
            .attr('y', d => (d as any).y0 + 13)
            .text(d => d.data.name);

    }, [data, sizeType]);

    return <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />;
}
