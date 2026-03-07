import React from "react";
import { ReactNode } from "react";
import { Marker } from "./main";

export interface RenderState {
    hoverIndex: number | null;
    selectionStart: number | null;
    selectionEnd: number | null;
    markers: Marker[];
    onMouseDown: (index: number) => void;
    onMouseEnter: (index: number) => void;
    onMouseLeave: () => void;
}

function zero(n: number, max: number) {
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
    const gen = function* () {
        for (let i = line * 16; i < Math.min(line * 16 + 16, buffer.length); i++) {
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

            if (state.hoverIndex === i) {
                classList.push("hovered");
            }

            if (state.selectionStart !== null && state.selectionEnd !== null) {
                const start = Math.min(state.selectionStart, state.selectionEnd);
                const end = Math.max(state.selectionStart, state.selectionEnd);
                if (i >= start && i <= end) {
                    classList.push("selected");
                }
            }

            for (const marker of state.markers) {
                if (i >= marker.start && i < marker.start + marker.length) {
                    classList.push("marked");
                    if (marker.type === 'length') {
                        classList.push("marked_length");
                    }
                }
            }

            yield (
                <span
                    key={i}
                    className={classList.join(" ")}
                    onMouseDown={() => state.onMouseDown(i)}
                    onMouseEnter={() => state.onMouseEnter(i)}
                    onMouseLeave={state.onMouseLeave}
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
    const gen = function* () {
        for (let i = line * 16; i < Math.min(line * 16 + 16, buffer.length); i++) {
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

            if (state.hoverIndex === i) {
                classList.push("hovered");
            }

            if (state.selectionStart !== null && state.selectionEnd !== null) {
                const start = Math.min(state.selectionStart, state.selectionEnd);
                const end = Math.max(state.selectionStart, state.selectionEnd);
                if (i >= start && i <= end) {
                    classList.push("selected");
                }
            }

            for (const marker of state.markers) {
                if (i >= marker.start && i < marker.start + marker.length) {
                    classList.push("marked");
                    if (marker.type === 'length') {
                        classList.push("marked_length");
                    }
                }
            }

            const space = i == line * 16 ? "" : " "
            const hex = zero(v, 2);
            yield (
                <React.Fragment key={i}>
                    {space && <span>{space}</span>}
                    <span
                        className={classList.join(" ")}
                        onMouseDown={() => state.onMouseDown(i)}
                        onMouseEnter={() => state.onMouseEnter(i)}
                        onMouseLeave={state.onMouseLeave}
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
