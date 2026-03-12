let initialized = false;
let compute_md5: any;

self.onmessage = async (e) => {
    const { data, algorithms, id } = e.data;

    if (!initialized) {
        // @ts-ignore
        const m = await import('./hex-viewer-wasm.js');
        await m.default();
        compute_md5 = m.compute_md5;
        initialized = true;
    }

    const results: { label: string, value: string }[] = [];

    if (algorithms.includes('MD5')) {
        results.push({ label: 'MD5', value: compute_md5(data) });
    }

    for (const algo of algorithms) {
        if (algo === 'MD5') continue;
        try {
            const hashBuffer = await crypto.subtle.digest(algo, data.buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            results.push({ label: algo, value: hashHex });
        } catch (e) {
            results.push({ label: algo, value: 'Error' });
        }
    }

    self.postMessage({ id, results });
};
