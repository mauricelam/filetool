import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SankeyData } from '../../hprof-wasm/pkg';
import { buildHierarchy, formatBytes } from '../utils/hierarchy';
import { HoverInfo } from './MemoryFlowView';

interface SunburstViewProps {
    data: SankeyData;
    onNodeClick: (id: string, name: string) => void;
    onExpandOthers?: (parentId: string) => void;
    onHover: (info: HoverInfo) => void;
}

export function SunburstView({ data, onNodeClick, onExpandOthers, onHover }: SunburstViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data.nodes.length) return;

        const container = svgRef.current.parentElement;
        if (!container) return;

        const updateSize = () => {
            const width = container.clientWidth || 800;
            const height = container.clientHeight || 800;
            const radius = Math.min(width, height) / 2 - 20;

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

            const partition = d3.partition<any>()
                .size([2 * Math.PI, radius]);

            partition(root);

            const arc = d3.arc<d3.HierarchyRectangularNode<any>>()
                .startAngle(d => d.x0)
                .endAngle(d => d.x1)
                .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
                .padRadius(radius / 2)
                .innerRadius(d => d.y0)
                .outerRadius(d => d.y1 - 1);

            const color = d3.scaleOrdinal(d3.schemeCategory10);

            const g = svg.append("g")
                .attr("transform", `translate(${width / 2},${height / 2})`);

            const path = g.selectAll("path")
                .data(root.descendants().filter(d => d.depth > 0))
                .join("path")
                .attr("fill-opacity", 0)
                .attr("d", arc)
                .transition()
                .duration(500)
                .attr("fill-opacity", 0.6)
                .attrTween("d", (d: any) => {
                    const i = d3.interpolate({ x0: d.x0, x1: d.x0, y0: d.y0, y1: d.y0 }, d);
                    return (t: any) => arc(i(t))!;
                })
                .selection()
                .attr("fill", d => {
                    if (d.data.name.startsWith("Others")) return "#ccc";
                    let curr = d;
                    while (curr.depth > 1) curr = curr.parent!;
                    return color(curr.data.name);
                })
                .attr("fill-opacity", 0.6)
                .attr("d", arc)
                .style("cursor", "pointer")
                .on("click", (event, d) => {
                    if (d.data.id && onNodeClick) {
                        onNodeClick(d.data.id, d.data.name);
                    } else if (!d.data.id && d.data.parent_id && onExpandOthers) {
                        onExpandOthers(d.data.parent_id);
                    }
                })
                .on("mouseover", function(event, d) {
                    d3.select(this).attr("fill-opacity", 0.9);
                    const node = d.data;
                    const lines = [
                        `Retained: ${formatBytes(node.retained_size)}`,
                        `${((d.value || 0) / (root.value || 1) * 100).toFixed(1)}% of view root`
                    ];
                    if (node.shallow_size > 0) lines.push(`Shallow: ${formatBytes(node.shallow_size)}`);
                    onHover({ title: node.name, lines });
                })
                .on("mouseout", function(event, d) {
                    d3.select(this).attr("fill-opacity", 0.6);
                    onHover(null);
                });

            // Center label group
            const centerLabel = g.append("g")
                .attr("class", "center-label")
                .style("pointer-events", "none");

            // Labels for segments
            g.selectAll("text.segment-label")
                .data(root.descendants().filter(d => d.depth > 0 && (d.x1 - d.x0) * (d.y0 + d.y1) / 2 > 40))
                .join("text")
                .attr("class", "segment-label")
                .attr("transform", function(d) {
                    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
                    const y = (d.y0 + d.y1) / 2;
                    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
                })
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-size", "9px")
                .style("fill", "#000")
                .style("pointer-events", "none")
                .text(d => {
                    const name = d.data.name;
                    const avgRadius = (d.y0 + d.y1) / 2;
                    const arcLength = (d.x1 - d.x0) * avgRadius;
                    if (name.length * 6 > arcLength) {
                        if (arcLength < 25) return "";
                        return name.substring(0, Math.floor(arcLength / 6) - 2) + "..";
                    }
                    return name;
                });
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);

    }, [data, onNodeClick, onExpandOthers]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <svg ref={svgRef} className="sunburst-svg" />
        </div>
    );
}
