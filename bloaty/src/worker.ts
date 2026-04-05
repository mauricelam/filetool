console.log("[BloatyWorker] Script starting...");

const BloatyModulePromise = import("./bloaty.js");

self.onerror = (message, source, lineno, colno, error) => {
    console.error("[BloatyWorker] Global error:", { message, source, lineno, colno, error });
};

self.onunhandledrejection = (event) => {
    console.error("[BloatyWorker] Unhandled rejection:", event.reason);
};

let bloaty: any;
let bloatyPromise: Promise<any> | null = null;

self.onmessage = async (e: MessageEvent) => {
    const { action, buffer, fileName, dataSources } = e.data;

    if (action === "run") {
        console.log(`[BloatyWorker] Running analysis for ${fileName}`, { dataSources });
        try {
            if (!bloaty) {
                console.log("[BloatyWorker] Initializing Bloaty WASM module...");
                if (!bloatyPromise) {
                    const locateFile = (path: string) => {
                        if (path.endsWith('.wasm')) {
                            const url = new URL('bloaty.wasm', import.meta.url).href;
                            console.log("[BloatyWorker] Locating WASM at:", url);
                            return url;
                        }
                        return path;
                    };

                    const BloatyModule = (await BloatyModulePromise).default;
                    console.log("[BloatyWorker] Module imported:", typeof BloatyModule);

                    bloatyPromise = BloatyModule({
                        locateFile,
                        print: (text: string) => console.log(`[Bloaty] ${text}`),
                        printErr: (text: string) => console.error(`[Bloaty Error] ${text}`),
                    });
                }
                bloaty = await bloatyPromise;
                console.log("[BloatyWorker] Bloaty WASM module initialized.");
            }

            const virtualPath = "/" + fileName;
            console.log(`[BloatyWorker] Writing ${buffer.byteLength} bytes to virtual path ${virtualPath}`);
            bloaty.FS.writeFile(virtualPath, new Uint8Array(buffer));

            if (typeof bloaty.run_bloaty !== 'function') {
                self.postMessage({ action: "error", error: "run_bloaty not found" });
                return;
            }

            // Run for TSV
            console.log("[BloatyWorker] Running Bloaty for TSV output...");
            const tsvArgs = new bloaty.StringVector();
            tsvArgs.push_back("bloaty");
            tsvArgs.push_back("--tsv");
            if (dataSources && dataSources.length > 0) {
                tsvArgs.push_back("-d");
                tsvArgs.push_back(dataSources.join(","));
            }
            tsvArgs.push_back(virtualPath);
            const tsvResult = bloaty.run_bloaty(tsvArgs);
            tsvArgs.delete();
            console.log("[BloatyWorker] TSV output received.", { length: tsvResult.length });

            if (tsvResult.startsWith("bloaty: ")) {
                self.postMessage({ action: "error", error: tsvResult.substring(8) });
                bloaty.FS.unlink(virtualPath);
                return;
            }

            // Run for text
            console.log("[BloatyWorker] Running Bloaty for human-readable output...");
            const textArgs = new bloaty.StringVector();
            textArgs.push_back("bloaty");
            if (dataSources && dataSources.length > 0) {
                textArgs.push_back("-d");
                textArgs.push_back(dataSources.join(","));
            }
            textArgs.push_back(virtualPath);
            const textResult = bloaty.run_bloaty(textArgs);
            textArgs.delete();
            console.log("[BloatyWorker] Human-readable output received.", { length: textResult.length });

            if (textResult.startsWith("bloaty: ")) {
                self.postMessage({ action: "error", error: textResult.substring(8) });
            } else {
                self.postMessage({ action: "result", text: textResult, tsv: tsvResult });
            }

            bloaty.FS.unlink(virtualPath);
        } catch (err: any) {
            console.error("Bloaty worker error:", err);
            self.postMessage({ action: "error", error: err.message || String(err) });
        }
    }
};
