import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { BloatyNode, formatBytes } from './utils';

interface TreemapViewProps {
    data: BloatyNode;
    sizeType: 'vmsize' | 'filesize';
}

export function TreemapView({ data, sizeType }: TreemapViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const container = svgRef.current?.parentElement;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!svgRef.current || !data) return;

        const container = svgRef.current.parentElement;
        if (!container) return;
        const width = container.clientWidth || 800;
        const height = 600;

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height)
            .style('display', 'block')
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

        const leaf = svg.selectAll<SVGGElement, d3.HierarchyRectangularNode<BloatyNode>>('g.leaf')
            .data(root.leaves())
            .join('g')
            .attr('class', 'leaf')
            .attr('transform', d => `translate(${d.x0},${d.y0})`);

        leaf.append('rect')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .attr('fill', d => {
                let curr: d3.HierarchyNode<BloatyNode> = d;
                while (curr.depth > 1) curr = curr.parent!;
                return color(curr.data.name);
            })
            .attr('fill-opacity', 0.6)
            .attr('width', d => Math.max(0, d.x1 - d.x0))
            .attr('height', d => Math.max(0, d.y1 - d.y0))
            .append('title')
            .text(d => `${d.ancestors().reverse().map(d => d.data.name).join('/')}\n${formatBytes(d.value || 0)}`);

        leaf.append('text')
            .attr('clip-path', d => `inset(0 0 0 0)`)
            .style('display', d => (d.x1 - d.x0 < 20 || d.y1 - d.y0 < 20) ? 'none' : null)
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
            .attr('x', d => d.x0 + 3)
            .attr('y', d => d.y0 + 13)
            .style('display', d => (d.x1 - d.x0 < 40 || d.y1 - d.y0 < 30) ? 'none' : null)
            .style('font-weight', 'bold')
            .text(d => d.data.name);

    }, [data, sizeType, data.vmsize, data.filesize]);

    return (
        <div style={{ flexGrow: 1, width: '100%', height: '600px', overflow: 'auto' }}>
            <svg ref={svgRef} />
        </div>
    );
}
