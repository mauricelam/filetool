export async function* traverse(entry: FileSystemEntry): AsyncGenerator<File> {
    if (entry.isFile) {
        yield await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        for (const child of entries) {
            yield* traverse(child);
        }
    }
}

export function processDataTransferItems(items: DataTransferItemList): Promise<File[]> {
    const files: File[] = [];
    const entries: FileSystemEntry[] = [];
    for (const item of items) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
            entries.push(entry);
        } else if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
                files.push(file);
            }
        } else {
            alert("Unsupported item kind: " + item.kind);
            console.error("Unsupported item: " + item);
        }
    }

    // DataTransferItems are invalid after any await points. Make sure
    // any files or FileSystemEntries are collected before entering here.
    async function continueAsync(): Promise<File[]> {
        for (const entry of entries) {
            for await (const file of traverse(entry)) {
                files.push(file);
            }
        }
        return files;
    }
    return continueAsync();
}