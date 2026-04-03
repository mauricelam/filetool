import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SankeyData } from '../../hprof-wasm/pkg';
import { buildHierarchy, formatBytes, HierarchyNode } from '../utils/hierarchy';
import { HoverInfo } from './MemoryFlowView';

interface TreemapViewProps {
    data: SankeyData;
    onNodeClick: (id: string, name: string) => void;
    onExpandOthers?: (parentId: string) => void;
    onHover?: (info: HoverInfo | null) => void;
}

export function TreemapView({ data, onNodeClick, onExpandOthers, onHover }: TreemapViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data.nodes.length) return;

        const container = svgRef.current.parentElement;
        if (!container) return;

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        const svg = d3.select(svgRef.current)
            .attr("viewBox", [0, 0, width, height]);

        svg.selectAll("*").remove();

        const hierarchyData = buildHierarchy(data);
        if (!hierarchyData) return;

        const root = d3.hierarchy(hierarchyData)
            .sum(d => d.retained_size)
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        d3.treemap<HierarchyNode>()
            .size([width, height])
            .paddingOuter(3)
            .paddingTop(19)
            .paddingInner(1)
            .round(true)
            (root);

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        const leaf = svg.selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", d => `translate(${d.x0},${d.y0})`);

        leaf.append("rect")
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => d.y1 - d.y0)
            .attr("fill", d => {
                if (d.data.name.startsWith("Others")) return "#ccc";
                let curr = d;
                while (curr.depth > 1) curr = curr.parent!;
                return color(curr.data.name);
            })
            .attr("fill-opacity", 0.6)
            .style("cursor", d => d.data.id ? "pointer" : "default")
            .on("click", (event, d) => {
                if (d.data.id && onNodeClick) {
                    onNodeClick(d.data.id, d.data.name);
                }
            })
            .on("mouseover", function(event, d: any) {
                d3.select(this).attr("fill-opacity", 0.8);
                if (onHover) {
                    onHover({
                        type: 'node',
                        title: d.data.name,
                        retainedSize: d.data.retained_size,
                        shallowSize: d.data.shallow_size
                    });
                }
            })
            .on("mouseout", function() {
                d3.select(this).attr("fill-opacity", 0.6);
                if (onHover) onHover(null);
            });

        leaf.append("text")
            .attr("x", 3)
            .attr("y", 13)
            .style("font-size", "10px")
            .style("pointer-events", "none")
            .text(d => {
                const name = d.data.name;
                if (d.x1 - d.x0 < 30 || d.y1 - d.y0 < 20) return "";
                return name;
            });

    }, [data, onNodeClick, onExpandOthers, onHover]);

    return <svg ref={svgRef} className="treemap-svg" style={{ width: '100%', height: '100%' }} />;
}
