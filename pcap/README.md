# PCAP Packet Capture Viewer

A web-based Wireshark packet capture analyzer powered by `@goodtools/wiregasm` (Wireshark 4.6 compiled to WebAssembly).

## Features

- **Wireshark WebAssembly Engine**: Parses `.pcap`, `.pcapng`, and `.cap` network capture files entirely client-side using Wireshark's native dissection engine.
- **Wireshark Display Filters**: Real-time evaluation and filtering using Wireshark display filter syntax (`tcp`, `dns`, `ip.src == 192.168.1.1`, `http`, etc.), complete with syntax validation.
- **3-Pane Wireshark Layout**:
  - **Packet List**: Summary table displaying packet number, timestamp, source, destination, protocol, length, info string, and protocol row background/foreground colors.
  - **Protocol Tree**: Interactive hierarchical view of packet protocol layers (`eth`, `ip`, `tcp`/`udp`, `dns`, `http`, etc.) with expandable/collapsible nodes.
  - **Hex Inspector**: Hex dump and ASCII view for packet data sources, highlighting payload byte ranges when hovered or selected in the protocol tree.
- **Capture Statistics**: Summarizes total packet count, matched packet count, capture duration, and file size.

## Technical Architecture

- **`main.tsx`**: React application component managing state, Wiregasm WebAssembly lifecycle, display filtering, protocol tree parsing, and hex payload highlighting.
- **`build.mjs`**: esbuild configuration that bundles `main.tsx` into `dist/pcap/main.js` and copies `@goodtools/wiregasm` WebAssembly binaries (`wiregasm.wasm`, `wiregasm.data`, `wiregasm.js`) into `dist/pcap/`.

## Dependencies

- **`@goodtools/wiregasm`**: WebAssembly build of Wireshark's packet dissection library (`sharkd`).
- **`react` & `react-dom`**: UI framework and rendering engine.

## Maintainer Expectations

- When updating `@goodtools/wiregasm` versions, ensure `build.mjs` continues to copy `wiregasm.wasm`, `wiregasm.data`, and `wiregasm.js` locally.
- Build scripts and execution must strictly adhere to hermetic requirements (all WebAssembly and data assets must be bundled and served locally from `dist/pcap/`).

## Development

```bash
# Build the workspace
npm run --workspace=@filetool/pcap build

# Watch mode for local development
npm run --workspace=@filetool/pcap watch
```
