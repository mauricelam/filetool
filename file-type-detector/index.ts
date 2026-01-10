import { WASMagic, WASMagicFlags } from 'wasmagic';

// --- Default Handler Logic ---

export const DEFAULT_FILE_HANDLERS_KEY = "DEFAULT_FILE_HANDLERS";

export interface DefaultHandlerPreferences {
    [key: string]: string;
}

export function getPreferences(): DefaultHandlerPreferences {
    try {
        const storedPrefs = localStorage.getItem(DEFAULT_FILE_HANDLERS_KEY);
        return storedPrefs ? JSON.parse(storedPrefs) : {};
    } catch (e) {
        console.error("Failed to parse default handler preferences:", e);
        return {};
    }
}

export function savePreferences(prefs: DefaultHandlerPreferences): void {
    try {
        localStorage.setItem(DEFAULT_FILE_HANDLERS_KEY, JSON.stringify(prefs));
    } catch (e) {
        console.error("Failed to save default handler preferences:", e);
    }
}

export function getDefaultHandler(mimetype: string, filename: string): string | undefined {
    const prefs = getPreferences();
    // Future enhancement: could check for filename patterns here
    return prefs[mimetype] || undefined;
}

export function setDefaultHandler(mimetype: string, filename: string, handlerId: string): void {
    const prefs = getPreferences();
    prefs[mimetype] = handlerId;
    savePreferences(prefs);
}


// --- Handler Matching Logic ---

interface MimeMatchDetailed {
    mime?: string | RegExp,
    filename?: string | RegExp,
    description?: string | RegExp,
}

type MimeMatch = MimeMatchDetailed | string | RegExp;

let magic: WASMagic | null = null;
let mimeMagic: WASMagic | null = null;

async function getMagic() {
    if (magic) return magic;
    magic = await WASMagic.create({ flags: WASMagicFlags.NONE });
    return magic;
}

async function getMimeMagic() {
    if (mimeMagic) return mimeMagic;
    mimeMagic = await WASMagic.create({ flags: WASMagicFlags.MIME_TYPE });
    return mimeMagic;
}

export function matchMimetype(mimeMatch: MimeMatch, mime: string, filename: string, description?: string | null): boolean {
    const matchStringOrRegex = (stringOrRegex: string | RegExp | undefined, matchee: string | null | undefined): boolean => {
        if (stringOrRegex === undefined) return true;
        if (matchee === undefined || matchee === null) return false;
        return typeof stringOrRegex === 'string' ? stringOrRegex === matchee : stringOrRegex.test(matchee);
    }

    if (typeof mimeMatch === 'object' && !(mimeMatch instanceof RegExp)) {
        return matchStringOrRegex(mimeMatch.mime, mime) &&
            matchStringOrRegex(mimeMatch.filename, filename) &&
            (mimeMatch.description === undefined || matchStringOrRegex(mimeMatch.description, description));
    } else {
        return matchStringOrRegex(mimeMatch, mime);
    }
}

export interface HandlerDefinition {
    name: string,
    handler: string,
    mimetypes: MimeMatch[]
}

export const HANDLERS: HandlerDefinition[] = [
    // ... (Handlers remain the same as before)
    {
        "name": "reStructuredText Viewer",
        "handler": "rstviewer",
        "mimetypes": [{ "filename": /\.(rst)$/i }, "text/x-rst", "text/prs.fallenstein.rst"]
    },
    {
        "name": "CBOR Viewer",
        "handler": "cborviewer",
        "mimetypes": ["application/cbor", { "filename": /\.cbor$/i }]
    },
    { "name": "Hex", "handler": "hex_viewer", "mimetypes": [/.*/] },
    { "name": "EML/MHTML", "handler": "mhtml", "mimetypes": ["message/rfc822"] },
    {
        "name": "Browser",
        "handler": "browser",
        "mimetypes": [
            "video/3gpp", "audio/x-m4a", "text/html", "audio/mpeg", "application/pdf",
            "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/vnd.microsoft.icon"
        ]
    },
    { "name": "DEX viewer", "handler": "dexviewer", "mimetypes": [{ "mime": "application/octet-stream", "filename": /.*\.dex/i }] },
    { "name": "Text Viewer", "handler": "textviewer", "mimetypes": [/text\/.*/, "message/rfc822", "image/svg+xml", "application/json", "application/javascript"] },
    { "name": "Graphviz Viewer", "handler": "graphviz", "mimetypes": ["text/vnd.graphviz", "application/vnd.graphviz", { "filename": /\.(dot|gv)$/i }] },
    { "name": "JQ Viewer", "handler": "jqviewer", "mimetypes": ["application/json", { "filename": /\.(json|jsonl)$/i }] },
    {
        "name": "3D model viewer",
        "handler": "webgl_previewer",
        "mimetypes": [
            "model/stl", "model/obj", "model/fbx", "model/ply", "application/sla",
            { "mime": "application/octet-stream", "filename": /.*\.stl$/i },
            { "mime": "application/octet-stream", "filename": /.*\.obj$/i },
            { "mime": "application/octet-stream", "filename": /.*\.glb$/i },
            { "mime": "application/octet-stream", "filename": /.*\.fbx$/i },
            { "mime": "application/octet-stream", "filename": /.*\.ply$/i },
            { "filename": /\.stl$/i }, { "filename": /\.obj$/i }, { "filename": /\.gltf$/i },
            { "filename": /\.glb$/i }, { "filename": /\.fbx$/i }, { "filename": /\.ply$/i }
        ]
    },
    { "name": "Webassembly text viewer", "handler": "wat_viewer", "mimetypes": ["application/wasm"] },
    {
        "name": "Open archive",
        "handler": "archive",
        "mimetypes": [
            "application/zip", "application/gzip", "application/x-xz", "application/vnd.android.package-archive",
            "application/x-rar", "application/x-7z-compressed", "application/java-archive", "application/x-lzh-compressed"
        ]
    },
    { "name": "ClassyShark", "handler": "classyshark", "mimetypes": [] },
    { "name": "Android APK viewer", "handler": "binaryxml", "mimetypes": ["application/vnd.android.package-archive", { "mime": "application/zip", "filename": /.*\.apk$/i }] },
    { "name": "JVM Classfile", "handler": "classfile", "mimetypes": ["application/x-java-applet"] },
    { "name": "Binutils", "handler": "binutils", "mimetypes": ["application/x-mach-binary", "application/x-executable", "application/x-sharedlib"] },
    {
        "name": "ImageMagick",
        "handler": "imagemagick",
        "mimetypes": [
            "image/jpeg", "image/png", "image/webp", "image/gif", "image/jxl", "image/vnd.microsoft.icon",
            "image/x-portable-pixmap", "image/tiff", "image/vnd.adobe.photoshop", "image/heif", "image/heic",
            { "mime": "application/octet-stream", "filename": /.*\.raw/i }, "font/sfnt", "image/apng", "image/avif"
        ]
    },
    { "name": "CheerpJ (JVM in browser, loads external code)", "handler": "cheerpj", "mimetypes": [] },
    {
        "name": "ffmpeg",
        "handler": "ffmpeg",
        "mimetypes": [
            "video/3gpp", "video/3gpp2", "audio/aac", "video/mpeg", "application/f4v", "audio/x-flac", "video/x-flv",
            "application/x-mpegURL", "video/mp4", "video/x-m4v", "video/x-matroska", "video/webm", "audio/mpeg",
            "audio/ogg", "video/ogg", "application/x-shockwave-flash", "audio/x-wav", "video/x-msvideo", "video/quicktime"
        ]
    },
    { "name": "markdown", "handler": "markdown", "mimetypes": [{ "filename": /\.md/i }] },
    {
        "name": "DER",
        "handler": "der",
        "mimetypes": [
            { "filename": new RegExp("\\\\.(der|crt|cer|pem|rsa)$", "i") }, "application/x-x509-ca-cert",
            "application/pkix-cert", "application/x-pem-file",
            { "mime": "application/octet-stream", "description": /DER Encoded PKCS#7 Signed Data/i }
        ]
    },
    { "name": "Protoscope", "handler": "protoscope", "mimetypes": [{ "mime": "application/x-protobuf" }, { "filename": /\.pb$/i }, { "filename": /\.binbp$/i }] },
    { "name": "SQLite Viewer", "handler": "sqliteviewer", "mimetypes": [{ "filename": /\.(sqlite|db)$/i }, "application/x-sqlite3", "application/vnd.sqlite3"] },
    { "name": "Proguard Viewer", "handler": "proguardviewer", "mimetypes": [{ "filename": /\.(map|mapping|txt)$/i }] },
    {
        "name": "LZFSE Decompressor",
        "handler": "lzfse",
        "mimetypes": [
            {
                description: /lzfse (encoded|compressed)/i,
            }
        ]
    },
];

export function sortHandlersBySpecificity(handlers: HandlerDefinition[], mime: string, filename: string): HandlerDefinition[] {
    const getScore = (handler: HandlerDefinition) => {
        let maxScore = 0;
        for (const mimeMatch of handler.mimetypes) {
            let currentScore = 0;
            if (typeof mimeMatch === 'object' && !(mimeMatch instanceof RegExp)) {
                if (mimeMatch.filename) currentScore += 10;
                if (mimeMatch.mime) currentScore += 5;
                if (mimeMatch.description) currentScore += 2;
            } else if (typeof mimeMatch === 'string') {
                if (mimeMatch.includes('*')) currentScore += 1; // Less specific
                else currentScore += 5; // Full mime type string
            } else if (mimeMatch instanceof RegExp) {
                if (mimeMatch.source.includes('.*')) currentScore += 1;
                else currentScore += 3;
            }
            if (currentScore > maxScore) {
                maxScore = currentScore;
            }
        }
        return maxScore;
    };
    return [...handlers].sort((a, b) => getScore(b) - getScore(a));
}


export async function getHandlersForFile(file: File): Promise<HandlerDefinition[]> {
    const [magic, mimeMagic] = await Promise.all([getMagic(), getMimeMagic()]);
    const buffer = new Uint8Array(await file.arrayBuffer());
    const mime = file.type || mimeMagic.detect(buffer) || 'application/octet-stream';
    const description = magic.detect(buffer);

    const matchingHandlers: HandlerDefinition[] = [];
    for (const handler of HANDLERS) {
        for (const mimetype of handler.mimetypes) {
            if (matchMimetype(mimetype, mime, file.name, description)) {
                matchingHandlers.push(handler);
                break;
            }
        }
    }
    return sortHandlersBySpecificity(matchingHandlers, mime, file.name);
}
