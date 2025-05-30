import { ArchiveCompression, ArchiveFormat } from 'libarchive.js';

declare module 'libarchive.js' {
    type ArchiveEntry = ArchiveFile | { [filename: string]: ArchiveEntry }

    interface ArchiveFile {
        _name: String;
        _path: String;
        _size: number;
        _lastModified: number;
        extract(): Promise<File>;
    }

    interface Archive {
        create(): Promise<Archive>;
        addFile(path: string, file: File): Promise<void>;
        write(mimeType: string): Promise<Blob>;
        getFilesObject(): Promise<{ [key: string]: ArchiveFile }>;
    }

    interface ArchiveStatic {
        create(): Promise<Archive>;
        open(file: File): Promise<Archive>;
        write(options: {
            files: { file: File; pathname: string }[];
            outputFileName: string;
            compression: ArchiveCompression;
            format: ArchiveFormat;
            passphrase: string | null;
        }): Promise<Blob>;
    }
} 