export async function* traverse(entry: FileSystemEntry): AsyncGenerator<File> {
    if (entry.isFile) {
        yield await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
            reader.readEntries(resolve, (e) => reject(new Error("Failed to read entries: " + e)));
        });
        for (const child of entries) {
            yield* traverse(child);
        }
    }
}

export interface DragItem {
    name?: string;
    files: File[];
}

export function processDataTransferItems(items: DataTransferItemList): Promise<DragItem[]> {
    const result: DragItem[] = [];
    const entries: FileSystemEntry[] = [];
    for (const item of items) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
            entries.push(entry);
        } else if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
                result.push({ files: [file] });
            }
        } else {
            alert("Unsupported item kind: " + item.kind);
            console.error("Unsupported item: " + item);
        }
    }

    // DataTransferItems are invalid after any await points. Make sure
    // any files or FileSystemEntries are collected before entering here.
    async function continueAsync(): Promise<DragItem[]> {
        for (const entry of entries) {
            if (entry.isDirectory) {
                const files: File[] = [];
                for await (const file of traverse(entry)) {
                    files.push(file);
                }
                result.push({ name: entry.name, files });
            } else {
                const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
                result.push({ files: [file] });
            }
        }
        return result;
    }
    return continueAsync();
}