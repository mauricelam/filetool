import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyCenter } from 'd3-sankey';
import { SankeyData, SankeyNode, SankeyLink } from '../../hprof-wasm/pkg';
import { formatBytes } from '../utils/hierarchy';

interface SankeyViewProps {
    data: SankeyData;
    onNodeClick?: (id: string) => void;
    onExpandOthers?: (parentId: string) => void;
}

export function SankeyView({ data, onNodeClick, onExpandOthers }: SankeyViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data.nodes.length) return;

        const width = svgRef.current.clientWidth || 800;
        const height = svgRef.current.clientHeight || 600;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const sankeyGenerator = sankey<SankeyNode, SankeyLink>()
            .nodeWidth(15)
            .nodePadding(10)
            .extent([[1, 20], [width - 1, height - 20]])
            .nodeId(d => (d as any).index)
            .nodeAlign(sankeyCenter);

        let sankeyData;
        try {
            sankeyData = sankeyGenerator({
                nodes: data.nodes.map(d => ({ ...d })),
                links: data.links.map(d => ({ ...d }))
            });
        } catch (e) {
            console.error("Sankey generation failed:", e);
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .text("Failed to generate Sankey diagram. The graph might contain cycles.");
            return;
        }

        const { nodes, links } = sankeyData;

        const color = d3.scaleOrdinal(d3.schemeCategory10);
        const nodeColor = (d: any) => {
            if (d.name.startsWith("Others")) return "#ccc";
            return color(d.index.toString());
        };

        const g = svg.append("g");

        g.append("g")
            .selectAll("rect")
            .data(nodes)
            .join("rect")
            .attr("x", d => (d as any).x0)
            .attr("y", d => (d as any).y0)
            .attr("height", d => Math.max(1, (d as any).y1 - (d as any).y0))
            .attr("width", d => (d as any).x1 - (d as any).x0)
            .attr("fill", (d: any) => nodeColor(d))
            .attr("stroke", "#000")
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                const node = d as any;
                if (node.id && onNodeClick) {
                    onNodeClick(node.id);
                } else if (!node.id && node.parent_id && onExpandOthers) {
                    onExpandOthers(node.parent_id);
                }
            })
            .append("title")
            .text(d => {
                const node = d as any;
                let text = `${node.name}\nRetained: ${formatBytes(node.retained_size)}`;
                if (node.shallow_size > 0) {
                    text += `\nShallow: ${formatBytes(node.shallow_size)}`;
                }
                return text;
            });

        const link = g.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.5)
            .selectAll("g")
            .data(links)
            .join("g")
            .style("mix-blend-mode", "multiply");

        link.append("path")
            .attr("d", sankeyLinkHorizontal())
            .attr("stroke", d => nodeColor(d.source))
            .attr("stroke-width", d => Math.max(1, (d as any).width || 0))
            .on("mouseover", (event, d: any) => {
                d3.select(event.currentTarget).attr("stroke-opacity", 0.8);
            })
            .on("mouseout", (event) => {
                d3.select(event.currentTarget).attr("stroke-opacity", 0.5);
            })
            .append("title")
            .text(d => {
                const percentage = (d.value / (d.source as any).retained_size * 100).toFixed(1);
                return `${(d.source as any).name} → ${(d.target as any).name}\n${(d as any).field_names?.join(', ') || 'retained'}\n${formatBytes(d.value)} (${percentage}% of parent)`;
            });

        link.append("text")
            .attr("class", "link-label")
            .attr("x", d => ((d.source as any).x1 + (d.target as any).x0) / 2)
            .attr("y", d => (d.y0 + d.y1) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-size", "9px")
            .style("fill", "#000")
            .style("pointer-events", "none")
            .text(d => {
                if (d.width! < 12) return "";
                const names = (d as any).field_names;
                if (!names || names.length === 0) return "";
                const s = names.join(", ");
                const maxWidth = (d.target as any).x0 - (d.source as any).x1 - 10;
                if (s.length * 6 > maxWidth) return s.substring(0, Math.floor(maxWidth / 6) - 3) + "...";
                return s;
            });

        g.append("g")
            .selectAll("foreignObject")
            .data(nodes)
            .join("foreignObject")
            .attr("class", "node-label")
            .attr("x", d => (d as any).x0 < width / 2 ? (d as any).x1 + 6 : (d as any).x0 - 156)
            .attr("y", d => ((d as any).y1 + (d as any).y0) / 2 - 25)
            .attr("width", 150)
            .attr("height", 50)
            .style("pointer-events", "none")
            .append("xhtml:div")
            .style("font", "10px sans-serif")
            .style("text-align", d => (d as any).x0 < width / 2 ? "left" : "right")
            .style("white-space", "normal")
            .style("word-break", "break-all")
            .style("overflow", "hidden")
            .style("display", "-webkit-box")
            .style("-webkit-line-clamp", "3")
            .style("-webkit-box-orient", "vertical")
            .html(d => {
                const node = d as any;
                const sizeStr = (node.depth === 0 || node.depth === 1) ? `<br/><span style="color: #666">${formatBytes(node.retained_size)}</span>` : "";
                return `<div>${node.name}${sizeStr}</div>`;
            });

    }, [data]);

    return <svg ref={svgRef} className="sankey-svg" style={{ width: '100%', height: '100%' }} />;
}
