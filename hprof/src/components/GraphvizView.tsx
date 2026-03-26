import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { graphviz } from 'd3-graphviz';

interface GraphvizViewProps {
    dot: string;
}

export function GraphvizView({ dot }: GraphvizViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphvizRef = useRef<any>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        if (!graphvizRef.current) {
            graphvizRef.current = graphviz(containerRef.current, {
                useWorker: false,
                width: '100%',
                height: '100%',
                fit: true,
                zoom: true,
            });
        }

        graphvizRef.current
            .renderDot(dot)
            .on('end', () => {
                const svg = d3.select(containerRef.current).select('svg');
                if (svg.empty()) return;

                const zoom = graphvizRef.current.zoomBehavior();
                if (!zoom) return;

                // Remove maximum zoom level
                zoom.scaleExtent([0, Infinity]);

                // Intercept the wheel event to distinguish between pan and zoom
                const originalWheel = svg.on('wheel.zoom');
                svg.on('wheel.zoom', (event: WheelEvent) => {
                    if (event.ctrlKey || event.metaKey) {
                        // Zoom behavior: call the original d3-zoom wheel handler
                        if (originalWheel) {
                            originalWheel.call(svg.node() as any, event);
                        }
                    } else {
                        // Pan behavior
                        event.preventDefault();
                        event.stopImmediatePropagation();

                        const multiplier = 20;
                        const currentTransform = d3.zoomTransform(svg.node() as any);
                        const newTransform = currentTransform.translate(
                            (-event.deltaX * multiplier) / currentTransform.k,
                            (-event.deltaY * multiplier) / currentTransform.k
                        );
                        svg.call(zoom.transform, newTransform);
                    }
                }, { passive: false });
            });
    }, [dot]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
