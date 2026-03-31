import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SankeyData } from '../../hprof-wasm/pkg';
import { buildHierarchy, formatBytes, HierarchyNode } from '../utils/hierarchy';

interface CirclePackingViewProps {
    data: SankeyData;
    onNodeClick?: (id: string) => void;
    onExpandOthers?: (parentId: string) => void;
}

export function CirclePackingView({ data, onNodeClick, onExpandOthers }: CirclePackingViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data.nodes.length) return;

        const container = svgRef.current.parentElement;
        if (!container) return;

        const updateSize = () => {
            const width = container.clientWidth || 800;
            const height = container.clientHeight || 800;

            const svg = d3.select(svgRef.current)
                .attr("viewBox", [-width / 2, -height / 2, width, height])
                .style("width", "100%")
                .style("height", "100%");

            svg.selectAll("*").remove();

            const hierarchyData = buildHierarchy(data);
            if (!hierarchyData) return;

            const root = d3.hierarchy(hierarchyData)
                .sum(d => d.shallow_size)
                .sort((a, b) => (b.value || 0) - (a.value || 0));

            d3.pack<HierarchyNode>()
                .size([width, height])
                .padding(3)
                (root);

            const color = d3.scaleOrdinal(d3.schemeCategory10);

            const node = svg.selectAll("g")
                .data(root.descendants())
                .join("g")
                .attr("transform", d => `translate(${d.x - width / 2},${d.y - height / 2})`);

            node.append("circle")
                .attr("r", d => d.r)
                .attr("fill", d => {
                    if (d.data.name.startsWith("Others")) return "#ccc";
                    let curr = d;
                    while (curr.depth > 1) curr = curr.parent!;
                    return color(curr.data.name);
                })
                .attr("fill-opacity", d => d.children ? 0.2 : 0.6)
                .style("cursor", "pointer")
                .on("click", (event, d) => {
                    if (d.data.id && onNodeClick) {
                        onNodeClick(d.data.id);
                    } else if (!d.data.id && d.data.parent_id && onExpandOthers) {
                        onExpandOthers(d.data.parent_id);
                    }
                })
                .on("mouseover", function() { d3.select(this).attr("fill-opacity", 0.9); })
                .on("mouseout", function(event, d: any) { d3.select(this).attr("fill-opacity", d.children ? 0.2 : 0.6); });

            node.append("clipPath")
                .attr("id", (d, i) => `clip-circle-${i}`)
                .append("circle")
                .attr("r", d => d.r);

            node.append("text")
                .attr("clip-path", (d, i) => `url(#clip-circle-${i})`)
                .attr("text-anchor", "middle")
                .attr("dy", "0.3em")
                .style("font-size", "10px")
                .style("pointer-events", "none")
                .text(d => {
                    if (d.r < 15) return "";
                    return d.data.name;
                });

            node.append("title")
                .text(d => `${d.data.name}\nRetained: ${formatBytes(d.data.retained_size)}\nShallow: ${formatBytes(d.data.shallow_size)}`);
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [data, onNodeClick, onExpandOthers]);

    return <svg ref={svgRef} className="circle-packing-svg" style={{ width: '100%', height: '100%' }} />;
}
