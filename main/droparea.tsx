import React, { useRef, useEffect, useState } from 'react';

interface DropAreaProps {
    onFilesSelected: (files: File[]) => void;
}

// Define interfaces for File System Access API
interface FileSystemEntry {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
    fullPath: string;
    filesystem: FileSystem;
    createReader?(): FileSystemDirectoryReader;
    file?(successCallback: (file: File) => void, errorCallback?: (error: Error) => void): void;
}

interface FileSystemFileEntry extends FileSystemEntry {
    file(callback: (file: File) => void): void;
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
    createReader(): FileSystemDirectoryReader;
}

interface FileSystemDirectoryReader {
    readEntries(callback: (entries: FileSystemEntry[]) => void): void;
}

export function DropArea({ onFilesSelected }: DropAreaProps) {
    const dropTargetRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDropOver, setIsDropOver] = useState(false);

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const pasteHint = isMac ? 'or Cmd-V to paste' : 'or Ctrl-V to paste';

    useEffect(() => {
        const dropTarget = dropTargetRef.current;
        if (!dropTarget) return;

        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            setIsDropOver(true);
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            setIsDropOver(false);
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        };

        const handleDrop = async (e: DragEvent) => {
            e.preventDefault();
            setIsDropOver(false);

            const files: File[] = [];
            const items = Array.from(e.dataTransfer!.items);

            const readEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
                return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
            };
            const getFile = (entry: FileSystemFileEntry): Promise<File> => {
                return new Promise((resolve, reject) => entry.file(resolve, reject));
            };

            async function* traverse(entry: FileSystemEntry): AsyncGenerator<File> {
                if (entry.isFile) {
                    yield await getFile(entry as FileSystemFileEntry);
                } else if (entry.isDirectory) {
                    const reader = (entry as FileSystemDirectoryEntry).createReader();
                    for (const entry of await readEntries(reader)) {
                        yield* traverse(entry);
                    }
                }
            }

            for (const item of items) {
                const entry = item.webkitGetAsEntry() as FileSystemEntry | null;
                if (entry) {
                    for await (const file of traverse(entry)) {
                        files.push(file);
                    }
                } else if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        files.push(file);
                    }
                } else {
                    alert(`Warning: Drop of non-file items is not supported. Dropped items:\nType: ${item.type}, Kind: ${item.kind}`);
                    console.warn('Unsupported drop item:', item);
                }
            }

            if (files.length > 0) {
                onFilesSelected(files);
            }
        };

        dropTarget.addEventListener('dragenter', handleDragEnter, false);
        dropTarget.addEventListener('dragleave', handleDragLeave, false);
        dropTarget.addEventListener('dragover', handleDragOver, false);
        dropTarget.addEventListener('drop', handleDrop, false);

        const preventDefaults = (e: DragEvent) => {
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'none';
                e.dataTransfer.effectAllowed = 'none';
            }
            e.preventDefault();
        };

        document.addEventListener('dragover', preventDefaults);
        document.addEventListener('dragend', preventDefaults);
        document.addEventListener('drop', preventDefaults);


        const handlePaste = async (e: ClipboardEvent) => {
            e.preventDefault();
            const files = Array.from(e.clipboardData?.items || [])
                .filter(item => item.kind === 'file')
                .map(item => item.getAsFile())
                .filter((file): file is File => file !== null);

            if (files.length > 0) {
                onFilesSelected(files);
                return;
            }

            const text = e.clipboardData?.getData('text/plain');
            if (text) {
                const file = new File([text], 'pasted.txt', { type: 'text/plain' });
                onFilesSelected([file]);
                return;
            }

            alert('Cannot parse information from clipboard');
        };

        document.addEventListener('paste', handlePaste);


        return () => {
            dropTarget.removeEventListener('dragenter', handleDragEnter, false);
            dropTarget.removeEventListener('dragleave', handleDragLeave, false);
            dropTarget.removeEventListener('dragover', handleDragOver, false);
            dropTarget.removeEventListener('drop', handleDrop, false);
            document.removeEventListener('dragover', preventDefaults);
            document.removeEventListener('dragend', preventDefaults);
            document.removeEventListener('drop', preventDefaults);
            document.removeEventListener('paste', handlePaste);
        };
    }, [onFilesSelected]);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            onFilesSelected(Array.from(e.target.files));
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div
            id="droptarget"
            ref={dropTargetRef}
            onClick={handleClick}
            className={isDropOver ? 'dropover' : ''}
        >
            <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#434343">
                <path
                    d="M186.67-120q-27.5 0-47.09-19.58Q120-159.17 120-186.67v-426.66q0-27.5 19.58-47.09Q159.17-680 186.67-680H380v66.67H186.67v426.66h586.66v-426.66H580V-680h193.33q27.5 0 47.09 19.58Q840-640.83 840-613.33v426.66q0 27.5-19.58 47.09Q800.83-120 773.33-120H186.67ZM480-322 318.67-483.33 366-530.67l80.67 80.34V-960h66.66v509.67L594-530.67l47.33 47.34L480-322Z" />
            </svg>
            <div>Drop file here</div>
            <div id="paste-hint" style={{ color: '#666', fontSize: 'smaller' }}>{pasteHint}</div>
            <input
                type="file"
                id="fileinput"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                onChange={handleFileInputChange}
            />
        </div>
    );
}
