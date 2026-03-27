import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { HierarchyData, HierarchyNode, HierarchyLink } from '../../hprof-wasm/pkg';

interface ExtendedHierarchyNode extends HierarchyNode, d3.SimulationNodeDatum {
    fontSize: number;
    width: number;
    height: number;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
}

interface ReferenceGraphViewProps {
    data: HierarchyData;
    onSelectNode?: (id: string, name: string) => void;
}

export function ReferenceGraphView({ data, onSelectNode }: ReferenceGraphViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedNode, setSelectedNode] = useState<ExtendedHierarchyNode | null>(null);

    const maxCount = useMemo(() => {
        return Math.max(...data.links.map(l => (l.count as number) || 0), 1);
    }, [data.links]);

    const maxSize = useMemo(() => {
        return Math.max(...data.nodes.map(n => Number(n.size) || 0), 1);
    }, [data.nodes]);

    useEffect(() => {
        if (!svgRef.current || !data.nodes.length) return;

        const width = svgRef.current.clientWidth || 800;
        const height = svgRef.current.clientHeight || 600;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const container = svg.append("g");

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 10])
            .on("zoom", (event) => {
                container.attr("transform", event.transform);
            });

        svg.call(zoom);

        // Markers for directed links
        container.append("defs").selectAll("marker")
            .data(["end"])
            .join("marker")
            .attr("id", "arrow-end")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 20)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("fill", "#999")
            .attr("d", "M0,-5L10,0L0,5");

        const nodeData: ExtendedHierarchyNode[] = data.nodes.map(n => {
            const scale = n.size ? Math.sqrt(Number(n.size) / maxSize) : 0;
            const fontSize = 12 + scale * 12;
            return { ...n, fontSize, width: 0, height: 0 } as ExtendedHierarchyNode;
        });

        const simulation = d3.forceSimulation<ExtendedHierarchyNode>(nodeData)
            .force("link", d3.forceLink<ExtendedHierarchyNode, HierarchyLink>(data.links).id(d => d.id).distance(300))
            .force("charge", d3.forceManyBody().strength(-3000))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("x", d3.forceX(width / 2).strength(0.1))
            .force("y", d3.forceY(height / 2).strength(0.1));

        const linkGroup = container.append("g")
            .attr("class", "links")
            .selectAll("g")
            .data(data.links)
            .join("g");

        const link = linkGroup.append("line")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", d => 1 + ((d.count as number) ? ((d.count as number) / maxCount * 8) : 1))
            .attr("marker-end", "url(#arrow-end)");

        const linkLabel = linkGroup.append("text")
            .attr("font-size", "10px")
            .attr("fill", "#666")
            .attr("text-anchor", "middle")
            .attr("dy", "-5px")
            .text(d => {
                if (d.retained_size) {
                    return `${d.retained_size.toLocaleString()} bytes`;
                }
                if (d.count) {
                     return d.count.toLocaleString();
                }
                return "";
            });

        const node = container.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(nodeData)
            .join("g")
            .attr("cursor", "pointer")
            .on("click", (event, d) => {
                event.stopPropagation();
                setSelectedNode(d);
                if (onSelectNode) onSelectNode(d.id, d.name);
            })
            .call(d3.drag<SVGGElement, ExtendedHierarchyNode>()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

        node.append("rect")
            .attr("fill", "#fff")
            .attr("stroke", (d: any) => d.is_root ? "#d9534f" : "#007bff")
            .attr("stroke-width", (d: any) => d.is_root ? 3 : 1.5)
            .attr("rx", 4)
            .attr("ry", 4);

        node.append("text")
            .attr("class", "node-label")
            .text(d => d.name)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "sans-serif")
            .style("pointer-events", "none")
            .style("font-size", d => `${d.fontSize}px`);

        // Field names next to source node
        const fieldLabels = node.append("g")
            .attr("class", "field-labels");

        // Update rect sizes based on text BBox
        node.each(function(d) {
            const textNode = d3.select(this).select("text.node-label").node() as SVGTextElement;
            const bbox = textNode.getBBox();
            const paddingX = 10;
            const paddingY = 6;
            d.width = bbox.width + paddingX;
            d.height = bbox.height + paddingY;
            d3.select(this).select("rect")
                .attr("x", -d.width / 2)
                .attr("y", -d.height / 2)
                .attr("width", d.width)
                .attr("height", d.height);
        });

        // Add collision force after we know the dimensions
        simulation.force("collide", d3.forceCollide<ExtendedHierarchyNode>().radius(d => Math.max(d.width, d.height) / 2 + 30));

        simulation.on("tick", () => {
            link
                .attr("x1", d => (d.source as any).x!)
                .attr("y1", d => (d.source as any).y!)
                .attr("x2", d => (d.target as any).x!)
                .attr("y2", d => (d.target as any).y!);

            linkLabel
                .attr("x", d => ((d.source as any).x! + (d.target as any).x!) / 2)
                .attr("y", d => ((d.source as any).y! + (d.target as any).y!) / 2);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);

            // Render field labels next to source node
            fieldLabels.each(function(d) {
                const group = d3.select(this);
                group.selectAll("*").remove();

                const outgoingLinks = data.links.filter(l => (l.source as any).id === d.id);
                outgoingLinks.forEach((l, i) => {
                    if (l.field_names && l.field_names.length > 0) {
                        const targetNode = (l.target as any);
                        const dx = targetNode.x! - d.x!;
                        const dy = targetNode.y! - d.y!;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist === 0) return;

                        const angle = Math.atan2(dy, dx);
                        const offsetX = Math.cos(angle) * (d.width / 2 + 10);
                        const offsetY = Math.sin(angle) * (d.height / 2 + 10);

                        group.append("text")
                            .attr("x", offsetX)
                            .attr("y", offsetY)
                            .attr("font-size", "9px")
                            .attr("fill", "#555")
                            .attr("text-anchor", offsetX > 0 ? "start" : "end")
                            .attr("dominant-baseline", "middle")
                            .text(l.field_names.join(", "));
                    }
                });
            });
        });

        svg.on("click", () => setSelectedNode(null));

        // Highlight retention path logic
        if (selectedNode) {
            link.attr("stroke", (d: any) => {
                if (d.target.id === selectedNode.id) return "#d9534f"; // Red: Direct retainers
                if (d.source.id === selectedNode.id) return "#0275d8"; // Blue: Directly retained
                return "#999";
            })
            .attr("stroke-opacity", (d: any) => {
                const isRelated = d.target.id === selectedNode.id || d.source.id === selectedNode.id;
                return isRelated ? 1 : 0.1;
            });
            node.attr("opacity", (d: any) => {
                const isSelected = d.id === selectedNode.id;
                const isRetainer = data.links.some(l => (l.target as any).id === selectedNode.id && (l.source as any).id === d.id);
                const isRetained = data.links.some(l => (l.source as any).id === selectedNode.id && (l.target as any).id === d.id);
                return isSelected || isRetainer || isRetained ? 1 : 0.1;
            });
        }

        return () => simulation.stop();
    }, [data, maxSize, maxCount, selectedNode]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <svg ref={svgRef} data-testid="reference-graph-svg" className="graph-svg" style={{ width: '100%', height: '100%', cursor: 'grab' }} />
            {selectedNode && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '15px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    border: '1px solid #ddd',
                    maxWidth: '300px',
                    zIndex: 100,
                    fontSize: '14px'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', wordBreak: 'break-all' }}>{selectedNode.name}</div>
                    <div style={{ color: '#666' }}>ID: {selectedNode.id}</div>
                    {selectedNode.size! > 0 && (
                        <div style={{ marginTop: '5px' }}>
                            Total Shallow Size: <span style={{ fontWeight: 'bold' }}>{Number(selectedNode.size).toLocaleString()} bytes</span>
                        </div>
                    )}
                    {selectedNode.retained_size && (
                        <div style={{ marginTop: '5px' }}>
                            Total Retained Size: <span style={{ fontWeight: 'bold' }}>{Number(selectedNode.retained_size).toLocaleString()} bytes</span>
                        </div>
                    )}
                    {(selectedNode as any).is_root && (
                        <div style={{ marginTop: '5px', color: '#d9534f', fontWeight: 'bold' }}>GC ROOT</div>
                    )}
                    <div style={{ marginTop: '10px', fontSize: '0.85em' }}>
                        <div style={{ color: '#d9534f' }}>● Red edges: Direct retainers</div>
                        <div style={{ color: '#0275d8' }}>● Blue edges: Directly retained</div>
                    </div>
                    <button
                        onClick={() => setSelectedNode(null)}
                        style={{ marginTop: '10px', width: '100%', padding: '5px', cursor: 'pointer' }}
                    >Close</button>
                </div>
            )}
        </div>
    );
}
