export const GHIDRA_RENAMES_KEY = 'ghidra_rename_mappings';
export const MAX_MAPPING_FILES = 64;

export interface FileRenameEntry {
    fileName: string;
    lastAccessed: number;
    functionRenames: Record<string, string>;
    variableRenames: Record<string, Record<string, string>>;
}

let lastTimestamp = 0;

export function getNextTimestamp(): number {
    const now = Date.now();
    lastTimestamp = Math.max(now, lastTimestamp + 1);
    return lastTimestamp;
}

export function loadAllEntries(): FileRenameEntry[] {
    try {
        if (typeof localStorage === 'undefined') return [];
        const raw = localStorage.getItem(GHIDRA_RENAMES_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        return [];
    } catch {
        return [];
    }
}

export function saveAllEntries(entries: FileRenameEntry[]): void {
    try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(GHIDRA_RENAMES_KEY, JSON.stringify(entries));
    } catch (e) {
        console.error('[GhidraRenameStorage] Failed to save to localStorage:', e);
    }
}

export function clearRenameEntries(): void {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(GHIDRA_RENAMES_KEY);
        }
    } catch {}
}

export function getFileRenameEntry(fileName: string): FileRenameEntry | null {
    if (!fileName) return null;
    const entries = loadAllEntries();
    const index = entries.findIndex(e => e.fileName === fileName);
    if (index === -1) return null;

    const entry = entries[index];
    entry.lastAccessed = getNextTimestamp();

    entries.splice(index, 1);
    entries.unshift(entry);
    saveAllEntries(entries);

    return entry;
}

export function saveFileRenameEntry(
    fileName: string,
    functionRenames: Record<string, string>,
    variableRenames: Record<string, Record<string, string>>
): void {
    if (!fileName) return;
    const entries = loadAllEntries();
    const existingIndex = entries.findIndex(e => e.fileName === fileName);

    const updatedEntry: FileRenameEntry = {
        fileName,
        lastAccessed: getNextTimestamp(),
        functionRenames: { ...functionRenames },
        variableRenames: { ...variableRenames }
    };

    if (existingIndex !== -1) {
        entries.splice(existingIndex, 1);
    }

    entries.unshift(updatedEntry);

    entries.sort((a, b) => b.lastAccessed - a.lastAccessed);

    const trimmed = entries.slice(0, MAX_MAPPING_FILES);

    saveAllEntries(trimmed);
}
