import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { sankeyCircular, sankeyLinkHorizontal } from 'd3-sankey-circular';
import { SankeyData, SankeyNode, SankeyLink } from '../../hprof-wasm/pkg';
import { formatBytes } from '../utils/hierarchy';
import { HoverInfo } from './MemoryFlowView';

interface SankeyViewProps {
    data: SankeyData;
    onNodeClick: (id: string, name: string) => void;
    onExpandOthers?: (parentId: string) => void;
    onHover?: (info: HoverInfo | null) => void;
}

export function SankeyView({ data, onNodeClick, onExpandOthers, onHover }: SankeyViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data.nodes.length) return;

        const container = svgRef.current.parentElement;
        if (!container) return;

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const sankeyGenerator = sankeyCircular<SankeyNode, SankeyLink>()
            .nodeWidth(15)
            .nodePadding(10)
            .extent([[1, 20], [width - 1, height - 20]])
            .nodeId(d => (d as any).index)
            .circularLinkGap(2);

        let sankeyData;
        try {
            const inputNodes = data.nodes.map((d, i) => ({ ...d, index: i }));
            const inputLinks = data.links.map(d => ({
                ...d,
                value: Math.max(1e-9, d.value)
            }));

            if (inputLinks.length === 0) {
                // Handle single node case which d3-sankey-circular might struggle with
                const n = inputNodes[0] as any;
                n.x0 = (width - 15) / 2;
                n.x1 = n.x0 + 15;
                n.y0 = (height - 50) / 2;
                n.y1 = n.y0 + 50;
                sankeyData = { nodes: inputNodes, links: [] };
            } else {
                sankeyData = sankeyGenerator({
                    nodes: inputNodes,
                    links: inputLinks
                });
            }
        } catch (e) {
            console.error("Sankey generation failed:", e);
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .text("Failed to generate Sankey diagram.");
            return;
        }

        const { nodes, links } = sankeyData;
        console.log("Sankey Data:", { nodes, links });

        const color = d3.scaleOrdinal(d3.schemeCategory10);
        const nodeColor = (d: any) => {
            if (d.name.startsWith("Others")) return "#ccc";
            return color(d.index.toString());
        };

        const g = svg.append("g");

        // Links
        const link = g.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.3)
            .selectAll("path")
            .data(links)
            .join("path")
            .attr("d", d => (d as any).path)
            .attr("stroke", d => nodeColor(d.source))
            .attr("stroke-width", d => Math.max(1, (d as any).width || 0))
            .style("mix-blend-mode", "multiply")
            .on("mouseover", (event, d: any) => {
                d3.select(event.currentTarget).attr("stroke-opacity", 0.7);
                if (onHover) {
                    onHover({
                        type: 'link',
                        title: d.source.name,
                        targetName: d.target.name,
                        retainedSize: d.value,
                        fieldNames: d.field_names,
                        percentageOfParent: (d.value / (d.source as any).retained_size * 100).toFixed(1)
                    });
                }
            })
            .on("mouseout", (event) => {
                d3.select(event.currentTarget).attr("stroke-opacity", 0.3);
                if (onHover) onHover(null);
            });

        // Nodes
        const node = g.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .style("cursor", d => d.id || (!d.id && d.parent_id) ? "pointer" : "default")
            .on("click", (event, d: any) => {
                if (d.id && onNodeClick) {
                    onNodeClick(d.id, d.name);
                } else if (!d.id && d.parent_id && onExpandOthers) {
                    onExpandOthers(d.parent_id);
                }
            })
            .on("mouseover", (event, d: any) => {
                if (onHover) {
                    onHover({
                        type: 'node',
                        title: d.name,
                        retainedSize: d.retained_size,
                        shallowSize: d.shallow_size
                    });
                }
            })
            .on("mouseout", () => {
                if (onHover) onHover(null);
            });

        node.append("rect")
            .attr("x", d => (d as any).x0)
            .attr("y", d => (d as any).y0)
            .attr("height", d => Math.max(1, (d as any).y1 - (d as any).y0))
            .attr("width", d => (d as any).x1 - (d as any).x0)
            .attr("fill", (d: any) => nodeColor(d))
            .attr("stroke", "#000");

        // Labels
        node.append("foreignObject")
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
                const n = d as any;
                const sizeStr = `<br/><span style="color: #666">${formatBytes(n.retained_size)}</span>`;
                return `<div>${n.name}${sizeStr}</div>`;
            });

    }, [data, onHover, onNodeClick, onExpandOthers]);

    return <svg ref={svgRef} className="sankey-svg" style={{ width: '100%', height: '100%' }} />;
}
