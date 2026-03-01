import React, { useEffect, useRef, useState } from 'react';
import { IframeMessage } from "filemagic-common/messages";
import { HandlerConfig } from "./App";

interface IframeManagerProps {
    activeHandler?: HandlerConfig;
    files: File[];
}

interface FrameData {
    id: string;
    file: File;
    handler: string;
    mime: string;
}

const MAX_IFRAMES = 5;

export const IframeManager = React.memo(({ activeHandler, files }: IframeManagerProps) => {
    const [frames, setFrames] = useState<FrameData[]>([]);
    const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());

    useEffect(() => {
        setFrames(currentFrames => currentFrames.filter(frame => files.includes(frame.file)));
    }, [files]);

    // Manage frames based on activeHandler
    useEffect(() => {
        if (!activeHandler) return;

        setFrames(currentFrames => {
            const newFrames = currentFrames.slice(0);
            const existingIndex = newFrames.findIndex(f => f.file === activeHandler.file);

            let newFrame: FrameData;
            if (existingIndex !== -1) {
                const existingFrame = newFrames.splice(existingIndex, 1)[0]
                newFrame = {
                    id: existingFrame.id,
                    file: activeHandler.file,
                    handler: activeHandler.handler,
                    mime: activeHandler.magicMime
                };
            } else {
                newFrame = {
                    id: crypto.randomUUID(),
                    file: activeHandler.file,
                    handler: activeHandler.handler,
                    mime: activeHandler.magicMime
                };
            }

            newFrames.push(newFrame)
            if (newFrames.length > MAX_IFRAMES) {
                newFrames.shift(); // FIFO eviction
            }
            return newFrames;
        });
    }, [activeHandler]);

    // Message Listener
    useEffect(() => {
        const onMessage = async (e: MessageEvent<IframeMessage>) => {
            let matchedFrame: FrameData | undefined;

            // Find which frame sent the message
            for (const [id, iframeEl] of iframeRefs.current.entries()) {
                if (iframeEl && iframeEl.contentWindow === e.source) {
                    matchedFrame = frames.find(f => f.id === id);
                    break;
                }
            }

            if (matchedFrame) {
                const file = matchedFrame.file;
                const mime = matchedFrame.mime;

                if (e.data.action === 'requestFile') {
                    if (file.type !== mime) {
                        console.log("Mismatched mime types", file.type, mime);
                    }
                    const fileCopy = new File([file], file.name, { type: mime });
                    (e.source as WindowProxy).postMessage(
                        { action: 'respondFile', file: fileCopy, originalType: file.type },
                        "/", [await file.arrayBuffer()]);
                } else if (e.data.action === 'openFile') {
                    console.log('onmessage', e.data);
                    window.dispatchEvent(new CustomEvent<File[]>("openFiles", { detail: [e.data.file] }));
                }
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [frames]);

    return (
        <div id="framecontainer">
            {frames.map(frame => {
                const isActive = activeHandler?.file === frame.file;
                return (
                    <iframe
                        key={frame.id}
                        ref={el => {
                            if (el) iframeRefs.current.set(frame.id, el);
                            else iframeRefs.current.delete(frame.id);
                        }}
                        src={frame.handler}
                        style={{ display: isActive ? 'block' : 'none' }}
                        title={frame.file.name}
                    />
                );
            })}
        </div>
    );
});
