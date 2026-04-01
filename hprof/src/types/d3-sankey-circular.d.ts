declare module 'd3-sankey-circular' {
    import { SankeyLayout, SankeyNode, SankeyLink, SankeyExtraProps } from 'd3-sankey';

    export interface SankeyCircularNode<N extends SankeyExtraProps = {}, L extends SankeyExtraProps = {}> extends SankeyNode<N, L> {
        column?: number;
        isCircular?: boolean;
    }

    export interface SankeyCircularLink<N extends SankeyExtraProps = {}, L extends SankeyExtraProps = {}> extends SankeyLink<N, L> {
        isCircular?: boolean;
        circularPathData?: string;
        path?: string;
    }

    export interface SankeyCircularLayout<N extends SankeyExtraProps = {}, L extends SankeyExtraProps = {}> extends SankeyLayout<SankeyCircularLayout<N, L>, N, L> {
        (data: { nodes: N[], links: L[] }): { nodes: SankeyCircularNode<N, L>[], links: SankeyCircularLink<N, L>[] };
        nodePadding(padding: number): this;
        nodeWidth(width: number): this;
        extent(extent: [[number, number], [number, number]]): this;
        size(size: [number, number]): this;
        iterations(iterations: number): this;
        circularLinkGap(gap: number): this;
        nodeId(id: (node: N) => any): this;
        nodeAlign(align: (node: SankeyCircularNode<N, L>, n: number) => number): this;
    }

    export function sankeyCircular<N extends SankeyExtraProps = {}, L extends SankeyExtraProps = {}>(): SankeyCircularLayout<N, L>;
    export function sankeyCenter(node: SankeyCircularNode, n: number): number;
}
