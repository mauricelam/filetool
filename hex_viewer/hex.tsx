import React from "react";
import { ReactNode } from "react";

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

export function renderAscii(line: number, buffer: Uint8Array): ReactNode {
    const gen = function*() {
        for (let i = line * 16; i < Math.min(line * 16 + 16, buffer.length); i++) {
            const v = buffer[i];
            const isAscii = (v > 31 && v < 127) || v > 159;
            let className = ""
            if (isAscii) {
                className = "char_ascii"
            } else if (v == 0) {
                className = "char_null"
            } else {
                className = "char_unknown"
            }
            yield (<span key={i} className={className}>{isAscii ? String.fromCharCode(v) : '.'}</span>)
        }
    }
    return (
        <>{Array.from(gen())}</>
    )
}

export function renderHex(line: number, buffer: Uint8Array): ReactNode {
    const gen = function*() {
        for (let i = line * 16; i < Math.min(line * 16 + 16, buffer.length); i++) {
            const v = buffer[i];
            const isAscii = (v > 31 && v < 127) || v > 159;
            let className = ""
            if (isAscii) {
                className = "char_ascii"
            } else if (v == 0) {
                className = "char_null"
            } else {
                className = "char_unknown"
            }
            const space = i == line * 16 ? "" : " "
            yield (<span key={i} className={className}>{space}{zero(v, 2)}</span>)
        }
    }
    return (
        <>{Array.from(gen())}</>
    )
}
