// @ts-ignore
import BloatyModule from "../bloaty-src/web/bloaty.js";

let bloaty: any;
let bloatyPromise: Promise<any> | null = null;

self.onmessage = async (e: MessageEvent) => {
    try {
        const { action, buffer, fileName, dataSources, format } = e.data;

        if (action === "run") {
            if (!bloaty) {
                if (!bloatyPromise) {
                    bloatyPromise = BloatyModule();
                }
                bloaty = await bloatyPromise;
            }

            const virtualPath = "/" + fileName;
            bloaty.FS.writeFile(virtualPath, new Uint8Array(buffer));

            const args = new bloaty.StringVector();
            args.push_back("bloaty");

            if (format === "tsv") {
                args.push_back("--tsv");
            }

            if (dataSources && dataSources.length > 0) {
                args.push_back("-d");
                args.push_back(dataSources.join(","));
            }

            args.push_back(virtualPath);

            if (typeof bloaty.run_bloaty !== 'function') {
                self.postMessage({ action: "error", error: "run_bloaty not found" });
                return;
            }

            const result = bloaty.run_bloaty(args);

            if (result && result.startsWith("bloaty: ")) {
                console.error("Bloaty returned error:", result);
                self.postMessage({ action: "error", error: result.substring(8) });
            } else {
                console.log("Bloaty finished successfully, result length:", result?.length);
                self.postMessage({ action: "result", result, format });
            }

            bloaty.FS.unlink(virtualPath);
            args.delete();
        }
    } catch (err: any) {
        console.error("Bloaty worker error:", err);
        self.postMessage({ action: "error", error: err.message || String(err) });
    }
};
