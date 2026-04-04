// @ts-ignore
import BloatyModule from "./bloaty.js";

let bloaty: any;
let bloatyPromise: Promise<any> | null = null;

self.onmessage = async (e: MessageEvent) => {
    const { action, buffer, fileName, dataSources } = e.data;

    if (action === "run") {
        try {
            if (!bloaty) {
                if (!bloatyPromise) {
                    bloatyPromise = BloatyModule({
                        locateFile: (path: string) => {
                            if (path.endsWith('.wasm')) {
                                return new URL('bloaty.wasm', import.meta.url).href;
                            }
                            return path;
                        }
                    });
                }
                bloaty = await bloatyPromise;
            }

            const virtualPath = "/" + fileName;
            bloaty.FS.writeFile(virtualPath, new Uint8Array(buffer));

            if (typeof bloaty.run_bloaty !== 'function') {
                self.postMessage({ action: "error", error: "run_bloaty not found" });
                return;
            }

            // Run for TSV
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

            if (tsvResult.startsWith("bloaty: ")) {
                self.postMessage({ action: "error", error: tsvResult.substring(8) });
                bloaty.FS.unlink(virtualPath);
                return;
            }

            // Run for text
            const textArgs = new bloaty.StringVector();
            textArgs.push_back("bloaty");
            if (dataSources && dataSources.length > 0) {
                textArgs.push_back("-d");
                textArgs.push_back(dataSources.join(","));
            }
            textArgs.push_back(virtualPath);
            const textResult = bloaty.run_bloaty(textArgs);
            textArgs.delete();

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
