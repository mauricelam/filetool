import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SankeyData } from '../../hprof-wasm/pkg';
import { buildHierarchy, formatBytes, HierarchyNode } from '../utils/hierarchy';
import { HoverInfo } from './MemoryFlowView';

interface IcicleViewProps {
    data: SankeyData;
    onNodeClick: (id: string, name: string) => void;
    onExpandOthers?: (parentId: string) => void;
    onHover: (info: HoverInfo) => void;
}

export function IcicleView({ data, onNodeClick, onExpandOthers, onHover }: IcicleViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data.nodes.length) return;

        const container = svgRef.current.parentElement;
        if (!container) return;

        const updateSize = () => {
            const width = container.clientWidth || 800;
            const height = container.clientHeight || 600;

            const svg = d3.select(svgRef.current)
                .attr("viewBox", [0, 0, width, height])
                .style("width", "100%")
                .style("height", "100%");

            svg.selectAll("*").remove();

            const hierarchyData = buildHierarchy(data);
            if (!hierarchyData) return;

            const root = d3.hierarchy(hierarchyData)
                .sum(d => d.shallow_size)
                .sort((a, b) => (b.value || 0) - (a.value || 0));

            d3.partition<HierarchyNode>()
                .size([width, height])
                .padding(1)
                (root);

            const color = d3.scaleOrdinal(d3.schemeCategory10);

            const cell = svg.selectAll("g")
                .data(root.descendants())
                .join("g")
                .attr("transform", d => `translate(${d.x0},${d.y0})`);

            cell.append("rect")
                .attr("width", d => d.x1 - d.x0)
                .attr("height", d => d.y1 - d.y0)
                .attr("fill-opacity", 0)
                .transition()
                .duration(500)
                .attr("fill-opacity", 0.6)
                .selection()
                .attr("fill", d => {
                    if (d.data.name.startsWith("Others")) return "#ccc";
                    let curr = d;
                    while (curr.depth > 1) curr = curr.parent!;
                    return color(curr.data.name);
                })
                .style("cursor", "pointer")
                .on("click", (event, d) => {
                    if (d.data.id && onNodeClick) {
                        onNodeClick(d.data.id, d.data.name);
                    } else if (!d.data.id && d.data.parent_id && onExpandOthers) {
                        onExpandOthers(d.data.parent_id);
                    }
                })
                .on("mouseover", (event, d) => {
                    d3.select(event.currentTarget).attr("fill-opacity", 0.8);
                    const node = d.data;
                    const lines = [`Retained: ${formatBytes(node.retained_size)}`];
                    if (node.shallow_size > 0) lines.push(`Shallow: ${formatBytes(node.shallow_size)}`);
                    onHover({ title: node.name, lines });
                })
                .on("mouseout", (event) => {
                    d3.select(event.currentTarget).attr("fill-opacity", 0.6);
                    onHover(null);
                });

            cell.append("clipPath")
                .attr("id", (d, i) => `clip-icicle-${i}`)
                .append("rect")
                .attr("width", d => d.x1 - d.x0)
                .attr("height", d => d.y1 - d.y0);

            cell.append("text")
                .attr("clip-path", (d, i) => `url(#clip-icicle-${i})`)
                .attr("x", 4)
                .attr("y", 13)
                .style("font-size", "10px")
                .style("pointer-events", "none")
                .text(d => {
                    const name = d.data.name;
                    if (d.x1 - d.x0 < 30 || d.y1 - d.y0 < 15) return "";
                    return name;
                });

        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [data, onNodeClick, onExpandOthers]);

    return <svg ref={svgRef} className="icicle-svg" style={{ width: '100%', height: '100%' }} />;
}
