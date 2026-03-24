export type RequestFileMessage = {
    action: 'requestFile';
};

export type RespondFileMessage = {
    action: 'respondFile';
    file: File;
    originalType?: string;
};

export type OpenFileMessage = {
    action: 'openFile';
    file: File;
    additionalFiles?: File[];
    handler?: string;
};

export type IframeMessage = RequestFileMessage | RespondFileMessage | OpenFileMessage;