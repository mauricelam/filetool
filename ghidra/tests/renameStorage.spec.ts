import { test, expect } from '@playwright/test';
import {
    getFileRenameEntry,
    saveFileRenameEntry,
    loadAllEntries,
    clearRenameEntries,
    MAX_MAPPING_FILES
} from '../src/renameStorage';

// In Node environment without DOM, polyfill localStorage for unit testing
if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
        getItem: (key: string) => store.get(key) || null,
        setItem: (key: string, val: string) => store.set(key, val),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear()
    };
}

test.describe('RenameStorage LRU Unit Tests', () => {
    test.beforeEach(() => {
        clearRenameEntries();
    });

    test('should save and retrieve rename mappings for a file', () => {
        saveFileRenameEntry(
            'libtest.so',
            { 'main': 'my_main' },
            { 'my_main': { 'uVar1': 'counter' } }
        );

        const entry = getFileRenameEntry('libtest.so');
        expect(entry).not.toBeNull();
        expect(entry?.fileName).toBe('libtest.so');
        expect(entry?.functionRenames).toEqual({ 'main': 'my_main' });
        expect(entry?.variableRenames).toEqual({ 'my_main': { 'uVar1': 'counter' } });
    });

    test('should update lastAccessed timestamp when retrieving entry', () => {
        saveFileRenameEntry('file1.so', { 'f1': 'func1' }, {});
        saveFileRenameEntry('file2.so', { 'f2': 'func2' }, {});

        const initialEntries = loadAllEntries();
        const file1InitialAccessed = initialEntries.find(e => e.fileName === 'file1.so')?.lastAccessed!;

        // Access file1.so to update its lastAccessed
        const accessed = getFileRenameEntry('file1.so');
        expect(accessed).not.toBeNull();
        expect(accessed?.lastAccessed).toBeGreaterThan(file1InitialAccessed);

        const updatedEntries = loadAllEntries();
        expect(updatedEntries[0].fileName).toBe('file1.so');
    });

    test('should limit stored mappings to 64 files using LRU eviction', () => {
        // Save 65 files
        for (let i = 1; i <= 65; i++) {
            saveFileRenameEntry(
                `file_${i}.so`,
                { 'func': `renamed_${i}` },
                {}
            );
        }

        const entries = loadAllEntries();
        expect(entries.length).toBe(MAX_MAPPING_FILES); // 64
        expect(entries.length).toBe(64);

        // The very first file saved ('file_1.so') should have been evicted
        const file1 = getFileRenameEntry('file_1.so');
        expect(file1).toBeNull();

        // The most recently saved files ('file_65.so', 'file_64.so', etc.) should remain
        const file65 = getFileRenameEntry('file_65.so');
        expect(file65).not.toBeNull();
        expect(file65?.functionRenames).toEqual({ 'func': 'renamed_65' });
    });
});
