import React, { useRef, useState, DragEvent, ClipboardEvent, useEffect } from 'react';

async function* traverse(entry: FileSystemEntry): AsyncGenerator<File> {
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

export function DropTarget({ onFiles }: { onFiles: (files: File[]) => void }) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [isDropOver, setDropOver] = useState(false);
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const pasteHint = isMac ? 'or Cmd-V to paste' : 'or Ctrl-V to paste';

    const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
        setDropOver(false);
        e.preventDefault();

        const files: File[] = [];
        const items = Array.from(e.dataTransfer!.items);

        for (const item of items) {
            const entry = item.webkitGetAsEntry();
            if (entry) {
                for await (const file of traverse(entry)) {
                    files.push(file);
                }
            } else if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    files.push(file);
                }
            }
        }

        if (files.length > 0) {
            onFiles(files);
        }
    };

    const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const files = Array.from(e.clipboardData?.items || [])
            .filter(item => item.kind === 'file')
            .map(item => item.getAsFile())
            .filter((file): file is File => file !== null);

        if (files.length > 0) {
            onFiles(files);
            return;
        }

        const text = e.clipboardData?.getData('text/plain');
        if (text) {
            const file = new File([text], 'pasted.txt', { type: 'text/plain' });
            onFiles([file]);
            return;
        }
    };

    // Global paste handler
    useEffect(() => {
        const globalPasteHandler = (e: globalThis.ClipboardEvent) => {
            // Need to cast to React's event type for handlePaste
            handlePaste(e as unknown as ClipboardEvent<HTMLDivElement>);
        };
        document.addEventListener('paste', globalPasteHandler);
        return () => document.removeEventListener('paste', globalPasteHandler);
    }, [onFiles]);


    return (
        <div id="droptarget"
            className={isDropOver ? 'dropover' : ''}
            onClick={() => fileInput.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
            onDragEnter={(e) => { e.preventDefault(); setDropOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDropOver(false); }}
        >
            <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#434343">
                <path
                    d="M186.67-120q-27.5 0-47.09-19.58Q120-159.17 120-186.67v-426.66q0-27.5 19.58-47.09Q159.17-680 186.67-680H380v66.67H186.67v426.66h586.66v-426.66H580V-680h193.33q27.5 0 47.09 19.58Q840-640.83 840-613.33v426.66q0 27.5-19.58 47.09Q800.83-120 773.33-120H186.67ZM480-322 318.67-483.33 366-530.67l80.67 80.34V-960h66.66v509.67L594-530.67l47.33 47.34L480-322Z" />
            </svg>
            <div>Drop file here</div>
            <div id="paste-hint" style={{ color: '#666', fontSize: 'smaller' }}>{pasteHint}</div>
            <input type="file" id="fileinput" style={{ display: 'none' }} multiple ref={fileInput} onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))} />
        </div>
    );
}
