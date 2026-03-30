import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SankeyData } from '../../hprof-wasm/pkg';

interface SunburstViewProps {
    data: SankeyData;
    onNodeClick?: (id: string) => void;
    onExpandOthers?: (parentId: string) => void;
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function SunburstView({ data, onNodeClick, onExpandOthers }: SunburstViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data.nodes.length) return;

        const container = svgRef.current.parentElement;
        const width = container?.clientWidth || 800;
        const height = container?.clientHeight || 800;
        const radius = Math.min(width, height) / 2;

        const svg = d3.select(svgRef.current)
            .attr("viewBox", [0, 0, width, height])
            .style("width", "100%")
            .style("height", "100%");

        svg.selectAll("*").remove();

        // Reconstruct hierarchy from SankeyData (nodes and links)
        const childrenMap = new Map<number, number[]>();
        data.links.forEach(link => {
            const children = childrenMap.get(link.source) || [];
            children.push(link.target);
            childrenMap.set(link.source, children);
        });

        function buildHierarchy(nodeIdx: number): any {
            const node = data.nodes[nodeIdx];
            const childrenIdxs = childrenMap.get(nodeIdx) || [];
            const children = childrenIdxs.map(buildHierarchy);

            return {
                name: node.name,
                id: node.id,
                parent_id: node.parent_id,
                retained_size: node.retained_size,
                children: children.length > 0 ? children : undefined
            };
        }

        const hierarchyData = buildHierarchy(0);

        const root = d3.hierarchy(hierarchyData)
            .sum(d => d.children ? 0 : d.retained_size)
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
            .attr("fill", d => {
                if (d.data.name === "<self>") return "#aaa";
                if (d.data.name.startsWith("Others")) return "#ccc";
                let curr = d;
                while (curr.depth > 1) curr = curr.parent!;
                return color(curr.data.name);
            })
            .attr("fill-opacity", d => d.children ? 0.6 : 0.4)
            .attr("d", arc)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                if (d.data.id && onNodeClick) {
                    onNodeClick(d.data.id);
                } else if (!d.data.id && d.data.parent_id && onExpandOthers) {
                    onExpandOthers(d.data.parent_id);
                }
            });

        path.append("title")
            .text(d => `${d.data.name}\nRetained: ${formatBytes(d.data.retained_size)}\n${((d.value || 0) / (root.value || 1) * 100).toFixed(1)}% of view root`);

        // Center label
        const center = g.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .style("font-size", "14px")
            .style("font-weight", "bold");

        center.append("tspan")
            .attr("x", 0)
            .text(root.data.name);
        center.append("tspan")
            .attr("x", 0)
            .attr("dy", "1.2em")
            .style("font-size", "12px")
            .style("font-weight", "normal")
            .style("fill", "#666")
            .text(formatBytes(root.value || 0));

        // Labels for segments
        g.selectAll("text.segment-label")
            .data(root.descendants().filter(d => d.depth > 0 && (d.x1 - d.x0) * (d.y1 - d.y0) > 0.05))
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
                const availableWidth = (d.y1 - d.y0);
                const avgRadius = (d.y0 + d.y1) / 2;
                const arcLength = (d.x1 - d.x0) * avgRadius;
                if (name.length * 6 > arcLength) {
                    if (arcLength < 25) return "";
                    return name.substring(0, Math.floor(arcLength / 6) - 2) + "..";
                }
                return name;
            });

    }, [data, onNodeClick, onExpandOthers]);

    return <svg ref={svgRef} className="sunburst-svg" />;
}
