import * as jsdiff from 'diff';

self.onmessage = (e) => {
    const { buf1, buf2 } = e.data;
    // buf1 and buf2 are Uint8Array

    // Size limit for jsdiff.diffArrays
    const JSDIFF_LIMIT = 5 * 1024 * 1024;

    if (buf1.length > JSDIFF_LIMIT || buf2.length > JSDIFF_LIMIT) {
        // Fallback: block-based diff for large files
        // We split the files into 1KB blocks and diff them
        const blockSize = 1024;
        const blocks1 = [];
        const blocks2 = [];

        for (let i = 0; i < buf1.length; i += blockSize) {
            blocks1.push(buf1.slice(i, i + blockSize).toString());
        }
        for (let i = 0; i < buf2.length; i += blockSize) {
            blocks2.push(buf2.slice(i, i + blockSize).toString());
        }

        const blockDiffs = jsdiff.diffArrays(blocks1, blocks2);
        // Expand block diffs back to byte diffs
        const expandedDiffs: jsdiff.Change[] = [];

        blockDiffs.forEach(part => {
            const partBlocks = part.value as string[];
            const byteValues: number[] = [];
            partBlocks.forEach(blockStr => {
                const blockBytes = blockStr.split(',').map(Number);
                byteValues.push(...blockBytes);
            });
            expandedDiffs.push({
                ...part,
                value: byteValues as any
            });
        });

        self.postMessage({ diffs: expandedDiffs });
    } else {
        const diffs = jsdiff.diffArrays(Array.from(buf1), Array.from(buf2));
        self.postMessage({ diffs });
    }
};
