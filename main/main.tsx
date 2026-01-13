import { WASMagic, WASMagicFlags } from "wasmagic";
import { createRoot } from 'react-dom/client';
import React, { ReactNode, useEffect, useState } from 'react';
import { HANDLERS, matchMimetype, getDefaultHandler, getHandlersForFileNameAndType } from 'file-type-detector';
import { FileItem, FileListItem } from "./fileitem";
import { IframeMessage } from "filemagic-common/messages";

const fileInput = document.getElementById('fileinput') as HTMLInputElement;

const infoToggle = document.getElementById('info-toggle')!!
const iconDown = document.getElementById('toggle-icon-down')!!
const iconUp = document.getElementById('toggle-icon-up')!!

infoToggle.onclick = () => {
    document.body.classList.toggle('collapsed');
    const isCollapsed = document.body.classList.contains('collapsed');
    iconDown.style.display = isCollapsed ? 'none' : 'block';
    iconUp.style.display = isCollapsed ? 'block' : 'none';
};

fileInput.onchange = (e) => fileInput.files && dispatchOpenFiles(Array.from(fileInput.files));

document.ondragover = (e) => {
    e.dataTransfer!.dropEffect = 'none'
    e.dataTransfer!.effectAllowed = 'none'
    e.preventDefault()
}
document.ondragend = (e) => e.preventDefault()
document.ondrop = (e) => e.preventDefault()

document.addEventListener('paste', async (e) => {
    e.preventDefault();
    const files = Array.from(e.clipboardData?.items || [])
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null);

    if (files.length > 0) {
        dispatchOpenFiles(files);
        return;
    }

    const text = e.clipboardData?.getData('text/plain');
    if (text) {
        const file = new File([text], 'pasted.txt', { type: 'text/plain' });
        dispatchOpenFiles([file]);
        return;
    }

    alert('Cannot parse information from clipboard');
});

const MAGIC = WASMagic.create({
    flags: WASMagicFlags.NONE,
    stdio: (name, text) => console.log(text)
})
const MIMEMAGIC = WASMagic.create({
    flags: WASMagicFlags.MIME_TYPE,
    stdio: (name, text) => console.log(text)
})
const resultDiv = createRoot(document.getElementById("result")!)
resultDiv.render(<FileList />)
setupMessageListener();

function setupMessageListener() {
    window.onmessage = async (e: MessageEvent<IframeMessage>) => {
        let file: File | null = null;
        for (const [f, i] of fileToIframe.entries()) {
            if (i.contentWindow === e.source) {
                file = f;
                break;
            }
        }

        if (file) {
            const iframe = fileToIframe.get(file)!;
            const mime = iframeToMime.get(iframe)!;
            if (e.data.action === 'requestFile') {
                if (file.type !== mime) {
                    console.log("Mismatched mime types", file.type, mime);
                }
                const fileCopy = new File([file], file.name, { type: mime });
                iframe.contentWindow!.postMessage(
                    { action: 'respondFile', file: fileCopy, originalType: file.type },
                    "/", [await file.arrayBuffer()]);
            } else if (e.data.action === 'openFile') {
                console.log('onmessage', e.data);
                window.dispatchEvent(new CustomEvent<File[]>("openFiles", { detail: [e.data.file] }));
            }
        }
    };
}

function dispatchOpenFiles(files: File[]) {
    window.dispatchEvent(new CustomEvent<File[]>("openFiles", { detail: files }))
}

const framecontainer = document.getElementById('framecontainer')!
const MAX_IFRAMES = 5;
const iframes: HTMLIFrameElement[] = [];
const fileToIframe = new Map<File, HTMLIFrameElement>();
const iframeToMime = new Map<HTMLIFrameElement, string>();
const iframeToHandler = new Map<HTMLIFrameElement, string>();

async function openHandler(handler: string, file: File, mime: string) {
    if (fileToIframe.has(file)) {
        const iframe = fileToIframe.get(file)!;
        if (iframeToHandler.get(iframe) !== handler) {
            iframe.removeAttribute('sandbox');
            iframe.src = handler;
            iframeToHandler.set(iframe, handler);
        }
        iframes.forEach(f => f.style.display = 'none');
        iframe.style.display = 'block';
        return;
    }

    let iframe: HTMLIFrameElement;
    if (iframes.length < MAX_IFRAMES) {
        iframe = document.createElement('iframe');
        iframes.push(iframe);
        framecontainer.appendChild(iframe);
    } else {
        iframe = iframes.shift()!;
        iframes.push(iframe);
        // Find the file associated with this iframe and remove it from the map
        for (const [file, frame] of fileToIframe.entries()) {
            if (frame === iframe) {
                fileToIframe.delete(file);
                break;
            }
        }
    }

    fileToIframe.set(file, iframe);
    iframeToMime.set(iframe, mime);
    iframeToHandler.set(iframe, handler);

    iframes.forEach(f => f.style.display = 'none');
    iframe.style.display = 'block';

    iframe.removeAttribute('sandbox');
    iframe.src = handler;
}

function FileList() {
    const [selected, setSelected] = useState(0)
    const [files, setFiles] = useState<File[]>([])
    const [isDragging, setIsDragging] = useState(false); // For visual feedback
    const [isAddFileHovered, setAddFileHovered] = useState(false);

    const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const files: File[] = [];
        const items = Array.from(e.dataTransfer!.items);

        const readEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
            return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
        };
        const getFile = (entry: FileSystemFileEntry): Promise<File> => {
            return new Promise((resolve, reject) => entry.file(resolve, reject))
        };

        async function* traverse(entry: FileSystemEntry): AsyncGenerator<File> {
            if (entry.isFile) {
                yield await getFile(entry as FileSystemFileEntry);
            } else if (entry.isDirectory) {
                const reader = (entry as FileSystemDirectoryEntry).createReader();
                for (const entry of await readEntries(reader)) {
                    yield* traverse(entry)
                }
            }
        };

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
            } else {
                alert(`Warning: Drop of non-file items is not supported. Dropped items:\nType: ${item.type}, Kind: ${item.kind}`);
                console.warn('Unsupported drop item:', item);
            }
        }

        if (files.length > 0) {
            dispatchOpenFiles(files);
        }
    };

    useEffect(() => {
        const handleOpenFile = (e: CustomEvent<File[]>) => {
            setFiles(cur => {
                const newFiles = e.detail.filter(file => !cur.find(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified));
                if (newFiles.length === 0) {
                    const existingFileIndex = cur.findIndex(f => e.detail.some(d => d.name === f.name && d.size === f.size && d.lastModified === f.lastModified));
                    if (existingFileIndex !== -1) {
                        setSelected(existingFileIndex);
                    }
                    return cur;
                }

                const updatedFiles = [...cur, ...newFiles];
                setSelected(updatedFiles.length - 1);
                return updatedFiles;
            });
        }
        window.addEventListener("openFiles", handleOpenFile as EventListener, false)
        return () => window.removeEventListener("openFiles", handleOpenFile as EventListener)
    }, [])

    useEffect(() => {
        if (files.length > 0) {
            infoToggle.style.display = 'flex';
        } else {
            infoToggle.style.display = 'none';
            document.body.classList.remove('collapsed');
            iconDown.style.display = 'block';
            iconUp.style.display = 'none';
        }
    }, [files]);

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (event.state && event.state.fileName) {
                const fileIndex = files.findIndex(f => f.name === event.state.fileName);
                if (fileIndex !== -1) {
                    setSelected(fileIndex);
                }
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [files, setSelected]);

    const removeFile = (index: number) => {
        setFiles(cur => {
            const newFiles = [...cur];
            newFiles.splice(index, 1);
            if (selected >= newFiles.length) {
                setSelected(newFiles.length - 1);
            }
            return newFiles;
        });
    };

    if (files.length > 0) {
        const selectedFile = files[selected];
        iframes.forEach(f => f.style.display = 'none');
        if (selectedFile && fileToIframe.has(selectedFile)) {
            fileToIframe.get(selectedFile)!.style.display = 'block';
        }

        return (
            <div style={{ display: 'flex', height: '100%' }}>
                <div style={{
                    width: '200px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '8px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: isDragging ? '#e6f3ff' : 'transparent'
                }}
                    onDrop={onDrop}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDragEnter={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                    }}
                >
                    <div style={{ flexGrow: 1 }}>
                        {files.map((file, index) => (
                            <FileListItem
                                key={`${file.name}-${file.lastModified}-${index}`}
                                file={file}
                                selected={index === selected}
                                onClick={() => setSelected(index)}
                                onRemove={() => removeFile(index)}
                            />
                        ))}
                    </div>
                    <div
                        onClick={() => fileInput.click()}
                        onMouseEnter={() => setAddFileHovered(true)}
                        onMouseLeave={() => setAddFileHovered(false)}
                        style={{
                            marginTop: '8px',
                            padding: '8px',
                            textAlign: 'center',
                            border: `1px dashed ${isAddFileHovered ? '#0066cc' : '#ccc'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            backgroundColor: isAddFileHovered ? '#e6f3ff' : 'transparent'
                        }}
                    >
                        Add file
                    </div>
                </div>
                <div style={{ flexGrow: 1, padding: '8px', position: 'relative' }}>
                    {selectedFile ? <LoadFileItem key={selected} file={selectedFile} /> : undefined}
                </div>
            </div>
        )
    } else {
        return (
            <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                <div id="droptarget"
                    onClick={() => fileInput.click()}
                    onDrop={onDrop}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'copy';
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#434343">
                        <path
                            d="M186.67-120q-27.5 0-47.09-19.58Q120-159.17 120-186.67v-426.66q0-27.5 19.58-47.09Q159.17-680 186.67-680H380v66.67H186.67v426.66h586.66v-426.66H580V-680h193.33q27.5 0 47.09 19.58Q840-640.83 840-613.33v426.66q0 27.5-19.58-47.09Q800.83-120 773.33-120H186.67ZM480-322 318.67-483.33 366-530.67l80.67 80.34V-960h66.66v509.67L594-530.67l47.33 47.34L480-322Z" />
                    </svg>
                    <div>Drop file here</div>
                    <div style={{ color: '#666', fontSize: 'smaller' }}>
                        or {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd-V' : 'Ctrl-V'} to paste
                    </div>
                </div>
            </div>
        )
    }
}

function LoadFileItem({ file }: { file: File }): ReactNode {
    const [handlers, setHandlers] = useState<any[]>([])
    const [mime, setMime] = useState("")
    const [description, setDescription] = useState("Loading...")
    useEffect(() => {
        const fun = async () => {
            const [magic, mimeMagic] = await Promise.all([MAGIC, MIMEMAGIC])
            const fileBuf = new Uint8Array(await file.arrayBuffer())
            const mime = mimeMagic.detect(fileBuf)
            const fileDescription = magic.detect(fileBuf) // Store description
            const handlers = getHandlersForFileNameAndType(file.name, mime, fileDescription);
            setMime(_ => mime)
            setHandlers(_ => handlers)
            setDescription(_ => fileDescription)

            // Push new state to history
            if (window.history.state?.fileName !== file.name) {
                window.history.pushState({
                    fileName: file.name,
                }, file.name);
            }

            // Check for and use default handler
            const defaultHandlerId = getDefaultHandler(mime, file.name);
            if (defaultHandlerId) {
                const defaultHandlerConfig = HANDLERS.find(h => h.handler === defaultHandlerId);
                if (defaultHandlerConfig) {
                    const isMatch = defaultHandlerConfig.mimetypes.some(m => matchMimetype(m, mime, file.name));
                    if (isMatch) {
                        setTimeout(
                            () => openHandler(defaultHandlerConfig.handler, file, mime),
                            0);
                    } else {
                        console.warn(`Default handler '${defaultHandlerId}' no longer matches file '${file.name}' (mime: '${mime}').`);
                    }
                } else {
                    console.warn(`Default handler '${defaultHandlerId}' not found in HANDLERS configuration.`);
                }
            }
        }
        fun()
    }, [setHandlers, setDescription, setMime, file])
    const defaultHandler = getDefaultHandler(mime, file.name);
    return (
        <FileItem
            key={file.name}
            file={file}
            name={file.name}
            mimetype={mime}
            description={description}
            matchedHandlers={handlers}
            allHandlers={HANDLERS}
            initialActiveHandler={defaultHandler}
            onOpenHandler={(handlerId, filename, mimetype) => {
                openHandler(handlerId, file, mimetype);
            }}
        />
    )
}
