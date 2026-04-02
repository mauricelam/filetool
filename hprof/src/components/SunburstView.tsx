import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SankeyData } from '../../hprof-wasm/pkg';
import { buildHierarchy, formatBytes } from '../utils/hierarchy';
import { HoverInfo } from './MemoryFlowView';

interface SunburstViewProps {
    data: SankeyData;
    onNodeClick: (id: string, name: string) => void;
    onExpandOthers?: (parentId: string) => void;
    onHover?: (info: HoverInfo | null) => void;
}

export function SunburstView({ data, onNodeClick, onExpandOthers, onHover }: SunburstViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data.nodes.length) return;

        const container = svgRef.current.parentElement;
        if (!container) return;

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 800;
        const radius = Math.min(width, height) / 2 - 20;

        const svg = d3.select(svgRef.current)
            .attr("viewBox", [0, 0, width, height]);

        svg.selectAll("*").remove();

        const hierarchyData = buildHierarchy(data);
        if (!hierarchyData) return;

        const root = d3.hierarchy(hierarchyData)
            .sum(d => d.retained_size) // Retained size for Sunburst
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

        g.selectAll("path")
            .data(root.descendants().filter(d => d.depth > 0))
            .join("path")
            .attr("fill", d => {
                if (d.data.name.startsWith("Others")) return "#ccc";
                let curr = d;
                while (curr.depth > 1) curr = curr.parent!;
                return color(curr.data.name);
            })
            .attr("fill-opacity", 0.6)
            .attr("d", arc)
            .style("cursor", d => d.data.id ? "pointer" : "default")
            .on("click", (event, d) => {
                if (d.data.id && onNodeClick) {
                    onNodeClick(d.data.id, d.data.name);
                }
            })
            .on("mouseover", function(event, d: any) {
                d3.select(this).attr("fill-opacity", 0.9);
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

        // Center label (always shows root)
        const center = g.append("g")
            .attr("text-anchor", "middle")
            .style("pointer-events", "none");

        center.append("text")
            .attr("dy", "-0.5em")
            .style("font-weight", "bold")
            .text(root.data.name);

        center.append("text")
            .attr("dy", "1em")
            .style("fill", "#666")
            .text(formatBytes(root.data.retained_size));

    }, [data, onNodeClick, onExpandOthers, onHover]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <svg ref={svgRef} className="sunburst-svg" style={{ width: '100%', height: '100%' }} />
        </div>
    );
}
