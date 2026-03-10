import React from "react";
import { ReactNode } from "react";
import { Marker } from "./main";

export interface RenderState {
    hoverIndex: number | null;
    selectionStart: number | null;
    selectionEnd: number | null;
    markers: Marker[];
    previewMarker?: Marker | null;
    searchResultOffsets: Set<number>;
    currentMatchOffset: number | null;
    matchLength: number;
    onMouseDown: (index: number) => void;
    onMouseEnter: (index: number) => void;
    onMouseLeave: () => void;
}

export function zero(n: number, max: number) {
    let padded = n.toString(16).toUpperCase();
    while (padded.length < max) {
        padded = '0' + padded;
    }
    return padded;
}

export function offset(line: number, buffer: Uint8Array): string {
    return zero(16 * line, Math.max(buffer.length.toString(16).length, 6))
}

export function renderAscii(line: number, buffer: Uint8Array, state: RenderState): ReactNode {
    return renderAsciiRange(line * 16, line * 16 + 16, buffer, state);
}

export function renderAsciiRange(start: number, end: number, buffer: Uint8Array, state: Partial<RenderState>): ReactNode {
    const fullState: RenderState = {
        hoverIndex: null,
        selectionStart: null,
        selectionEnd: null,
        markers: [],
        searchResultOffsets: new Set(),
        currentMatchOffset: null,
        matchLength: 0,
        onMouseDown: () => { },
        onMouseEnter: () => { },
        onMouseLeave: () => { },
        ...state
    };
    const gen = function* () {
        for (let i = start; i < Math.min(end, buffer.length); i++) {
            const v = buffer[i];
            const isAscii = (v > 31 && v < 127) || v > 159;
            const classList = [];
            if (isAscii) {
                classList.push("char_ascii");
            } else if (v == 0) {
                classList.push("char_null");
            } else {
                classList.push("char_unknown");
            }

            if (fullState.hoverIndex === i) {
                classList.push("hovered");
            }

            if (fullState.selectionStart !== null && fullState.selectionEnd !== null) {
                const s = Math.min(fullState.selectionStart, fullState.selectionEnd);
                const e = Math.max(fullState.selectionStart, fullState.selectionEnd);
                if (i >= s && i <= e) {
                    classList.push("selected");
                }
            }

            for (const marker of fullState.markers) {
                if (i >= marker.start && i < marker.start + marker.length) {
                    classList.push("marked");
                    if (marker.type === 'length') {
                        if (marker.headerLength !== undefined && i < marker.start + marker.headerLength) {
                            // keep default marked style (yellow)
                        } else {
                            classList.push("marked_length");
                        }
                        if (marker.start + marker.length > buffer.length) {
                            classList.push("marked_overflow");
                        }
                    }
                }
            }

            if (fullState.previewMarker && i >= fullState.previewMarker.start && i < fullState.previewMarker.start + fullState.previewMarker.length) {
                classList.push("preview_marked");
            }

            if (fullState.searchResultOffsets.has(i)) {
                classList.push("search-match");
            }
            if (fullState.currentMatchOffset !== null && i >= fullState.currentMatchOffset && i < fullState.currentMatchOffset + fullState.matchLength) {
                classList.push("current-match");
            }

            yield (
                <span
                    key={i}
                    className={classList.join(" ")}
                    onMouseDown={() => fullState.onMouseDown(i)}
                    onMouseEnter={() => fullState.onMouseEnter(i)}
                    onMouseLeave={fullState.onMouseLeave}
                >
                    {isAscii ? String.fromCharCode(v) : '.'}
                </span>
            )
        }
    }
    return (
        <>{Array.from(gen())}</>
    )
}

export function renderHex(line: number, buffer: Uint8Array, state: RenderState): ReactNode {
    return renderHexRange(line * 16, line * 16 + 16, buffer, state);
}

export function renderHexRange(start: number, end: number, buffer: Uint8Array, state: Partial<RenderState>): ReactNode {
    const fullState: RenderState = {
        hoverIndex: null,
        selectionStart: null,
        selectionEnd: null,
        markers: [],
        searchResultOffsets: new Set(),
        currentMatchOffset: null,
        matchLength: 0,
        onMouseDown: () => { },
        onMouseEnter: () => { },
        onMouseLeave: () => { },
        ...state
    };
    const gen = function* () {
        for (let i = start; i < Math.min(end, buffer.length); i++) {
            const v = buffer[i];
            const isAscii = (v > 31 && v < 127) || v > 159;
            const classList = [];
            if (isAscii) {
                classList.push("char_ascii");
            } else if (v == 0) {
                classList.push("char_null");
            } else {
                classList.push("char_unknown");
            }

            if (fullState.hoverIndex === i) {
                classList.push("hovered");
            }

            if (fullState.selectionStart !== null && fullState.selectionEnd !== null) {
                const s = Math.min(fullState.selectionStart, fullState.selectionEnd);
                const e = Math.max(fullState.selectionStart, fullState.selectionEnd);
                if (i >= s && i <= e) {
                    classList.push("selected");
                }
            }

            for (const marker of fullState.markers) {
                if (i >= marker.start && i < marker.start + marker.length) {
                    classList.push("marked");
                    if (marker.type === 'length') {
                        if (marker.headerLength !== undefined && i < marker.start + marker.headerLength) {
                            // keep default marked style (yellow)
                        } else {
                            classList.push("marked_length");
                        }
                        if (marker.start + marker.length > buffer.length) {
                            classList.push("marked_overflow");
                        }
                    }
                }
            }

            if (fullState.previewMarker && i >= fullState.previewMarker.start && i < fullState.previewMarker.start + fullState.previewMarker.length) {
                classList.push("preview_marked");
            }

            if (fullState.searchResultOffsets.has(i)) {
                classList.push("search-match");
            }
            if (fullState.currentMatchOffset !== null && i >= fullState.currentMatchOffset && i < fullState.currentMatchOffset + fullState.matchLength) {
                classList.push("current-match");
            }

            const space = i == start ? "" : " "
            const hex = zero(v, 2);
            yield (
                <React.Fragment key={i}>
                    {space && <span>{space}</span>}
                    <span
                        className={classList.join(" ")}
                        onMouseDown={() => fullState.onMouseDown(i)}
                        onMouseEnter={() => fullState.onMouseEnter(i)}
                        onMouseLeave={fullState.onMouseLeave}
                    >
                        {hex}
                    </span>
                </React.Fragment>
            )
        }
    }
    return (
        <>{Array.from(gen())}</>
    )
}
