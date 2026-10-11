let initialized = false;
let compute_md5: any;

self.onmessage = async (e) => {
    const { data, blob, algorithms, id } = e.data;

    if (!initialized) {
        // @ts-ignore
        const m = await import('./hex-viewer-wasm.js');
        await m.default();
        compute_md5 = m.compute_md5;
        initialized = true;
    }

    const results: { label: string, value: string }[] = [];

    // Extract raw byte array from incoming payload (either a slice/chunk Blob or raw Uint8Array/ArrayBuffer)
    let bytes: Uint8Array;
    if (blob) {
        bytes = new Uint8Array(await blob.arrayBuffer());
    } else if (data instanceof Uint8Array) {
        bytes = data;
    } else {
        bytes = new Uint8Array(data);
    }

    if (algorithms.includes('MD5')) {
        try {
            // compute_md5 calls into compiled Rust WASM; wrapped in try-catch in case of WASM allocation/panic errors
            results.push({ label: 'MD5', value: compute_md5(bytes) });
        } catch (err) {
            results.push({ label: 'MD5', value: 'Error' });
        }
    }

    for (const algo of algorithms) {
        if (algo === 'MD5') continue;
        try {
            const hashBuffer = await crypto.subtle.digest(algo, bytes.buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            results.push({ label: algo, value: hashHex });
        } catch (e) {
            results.push({ label: algo, value: 'Error' });
        }
    }

    self.postMessage({ id, results });
};
