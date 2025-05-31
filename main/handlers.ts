interface MimeMatchDetailed {
    mime?: string | RegExp,
    filename?: string | RegExp,
    description?: string | RegExp, // Added field
}

type MimeMatch = MimeMatchDetailed | string | RegExp;

export function matchMimetype(mimeMatch: MimeMatch, mime: string, filename: string, description?: string | null): boolean {
    const matchStringOrRegex = (stringOrRegex: string | RegExp | undefined, matchee: string | null | undefined): boolean => {
        if (stringOrRegex === undefined) {
            return true; // Handler rule does not specify this part, so it's a match for this part
        }
        if (matchee === undefined || matchee === null) {
            return false; // Handler rule requires something, but we don't have it
        }
        // Now matchee is definitely a string
        if (typeof stringOrRegex === 'string') {
            return stringOrRegex === matchee;
        } else { // stringOrRegex is a RegExp
            return stringOrRegex.test(matchee as string);
        }
    }

    if (typeof mimeMatch === 'object' && !(mimeMatch instanceof RegExp)) {
        // Check mime part
        if (!matchStringOrRegex(mimeMatch.mime, mime)) {
            return false;
        }
        // Check filename part
        if (!matchStringOrRegex(mimeMatch.filename, filename)) {
            return false;
        }
        // Check description part if specified in the handler rule
        if (mimeMatch.description !== undefined) {
            // If handler expects a description, the provided description must match
            return matchStringOrRegex(mimeMatch.description, description);
        }
        // If mimeMatch.description is undefined, it means this rule doesn't care about description.
        // And we've already matched mime and filename.
        return true;
    } else { // mimeMatch is a string or RegExp (only for mime type)
        return matchStringOrRegex(mimeMatch, mime);
    }
}

export const HANDLERS: { name: string, handler: string, mimetypes: MimeMatch[] }[] = [
    {
        "name": "DER Viewer",
        "handler": "der", // Assuming "der" is the correct handler ID
        "mimetypes": [
            {
                mime: "application/octet-stream",
                description: /DER Encoded PKCS#7 Signed Data/i,
            },
            // Keep existing DER handler entries if they are different
            // For example, if there's one for specific file extensions:
            // {
            //     filename: /\.(der|crt|cer|pem|rsa)$/i,
            // },
            // "application/x-x509-ca-cert",
            // "application/pkix-cert",
            // "application/x-pem-file",
        ]
    },
    {
        "name": "Hex",
        "handler": "hex_viewer",
        "mimetypes": [
            /.*/
        ]
    },
    {
        "name": "EML/MHTML",
        "handler": "mhtml",
        "mimetypes": [
            "message/rfc822",
        ]
    },
    {
        "name": "Browser",
        "handler": "browser",
        "mimetypes": [
            "video/3gpp",
            "video/mp4",
            "audio/x-m4a",
            "text/html",
            "audio/mpeg",
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/svg+xml",
            "image/vnd.microsoft.icon",
        ]
    },
    {
        "name": "Go DEX viewer",
        "handler": "dexviewer",
        "mimetypes": [
            {
                mime: "application/octet-stream",
                filename: /.*\.dex/i,
            },
        ]
    },
    {
        "name": "DEX viewer",
        "handler": "rustdexviewer",
        "mimetypes": [
            {
                mime: "application/octet-stream",
                filename: /.*\.dex/i,
            },
        ]
    },
    {
        "name": "Text Viewer",
        "handler": "textviewer",
        "mimetypes": [
            /text\/.*/,
            "message/rfc822",
            "image/svg+xml",
            "application/json",
            "application/javascript",
        ]
    },
    {
        "name": "JQ Viewer",
        "handler": "jqviewer",
        "mimetypes": [
            "application/json",
            {
                filename: /\.(json|jsonl)$/i,
            }
        ]
    },
    {
        "name": "3D model viewer",
        "handler": "webgl_previewer",
        "mimetypes": [
            "model/stl",
            "model/obj",
            "model/fbx",
            "model/ply",
            "application/sla", // Common alternative MIME type for STL
            {
                mime: "application/octet-stream",
                filename: /.*\.stl$/i,
            },
            {
                mime: "application/octet-stream",
                filename: /.*\.obj$/i,
            },
            {
                mime: "application/octet-stream",
                filename: /.*\.glb$/i,
            },
            {
                mime: "application/octet-stream",
                filename: /.*\.fbx$/i,
            },
            {
                mime: "application/octet-stream",
                filename: /.*\.ply$/i,
            },
            {
                filename: /\.stl$/i,
            },
            {
                filename: /\.obj$/i,
            },
            {
                filename: /\.gltf$/i,
            },
            {
                filename: /\.glb$/i,
            },
            {
                filename: /\.fbx$/i,
            },
            {
                filename: /\.ply$/i,
            }
        ]
    },
    {
        "name": "Webassembly text viewer",
        "handler": "wat_viewer",
        "mimetypes": [
            "application/wasm",
        ]
    },
    {
        "name": "Open archive",
        "handler": "archive",
        "mimetypes": [
            "application/zip",
            "application/gzip",
            "application/x-xz",
            "application/vnd.android.package-archive",  // APK
            "application/x-rar",
            "application/x-7z-compressed",
            "application/java-archive",
            "application/x-lzh-compressed",
        ]
    },
    {
        "name": "ClassyShark",
        "handler": "classyshark",
        "mimetypes": [
            // Disabled since it takes too long to load
            // "application/vnd.android.package-archive",
            // {
            //     "mime": "application/zip",
            //     "filename": /.*\.jar|.*\.aar/i,
            // }
        ]
    },
    {
        "name": "Android APK viewer",
        "handler": "binaryxml",
        "mimetypes": [
            "application/vnd.android.package-archive",
            {
                mime: "application/zip",
                filename: /.*\.apk$/i,
            }
        ]
    },
    {
        "name": "JVM Classfile",
        "handler": "classfile",
        "mimetypes": [
            "application/x-java-applet",
        ]
    },
    {
        "name": "Binutils",
        "handler": "binutils",
        "mimetypes": [
            "application/x-mach-binary",
            "application/x-executable",
            "application/x-sharedlib",
        ]
    },
    {
        "name": "ImageMagick",
        "handler": "imagemagick",
        "mimetypes": [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/jxl",
            "image/vnd.microsoft.icon",
            "image/x-portable-pixmap",
            "image/tiff",
            "image/vnd.adobe.photoshop",
            "image/heif",
            "image/heic",
            {
                "mime": "application/octet-stream",
                "filename": /.*\.raw/i,
            },
            "font/sfnt",
            "image/apng",
            "image/avif",
        ]
    },
    {
        "name": "CheerpJ (JVM in browser, loads external code)",
        "handler": "cheerpj",
        "mimetypes": [
            {
                mime: "application/zip",
                filename: /.*\.jar/,
            }
        ]
    },
    {
        "name": "ffmpeg",
        "handler": "ffmpeg",
        "mimetypes": [
            "video/3gpp",
            "video/3gpp2",
            "audio/aac",
            "video/mpeg",
            "application/f4v",
            "audio/x-flac",
            "video/x-flv",
            "application/x-mpegURL",
            "video/mp4",
            "video/x-m4v",
            "video/x-matroska",
            "video/webm",
            "audio/mpeg",
            "audio/ogg",
            "video/ogg",
            "application/x-shockwave-flash",
            "audio/x-wav",
            "video/x-msvideo",
            "video/quicktime",
        ]
    },
    {
        "name": "markdown",
        "handler": "markdown",
        "mimetypes": [
            {
                filename: /\.md/i,
            }
        ]
    },
    {
        "name": "DER",
        "handler": "der",
        "mimetypes": [
            {
                filename: new RegExp("\\\\.(der|crt|cer|pem|rsa)$", "i"), // Using new RegExp()
                // mime: undefined, // Implicitly undefined
                // description: undefined // Implicitly undefined
            },
            "application/x-x509-ca-cert",
            "application/pkix-cert",
            "application/x-pem-file",
        ]
    },
    {
        "name": "Protoscope",
        "handler": "protoscope",
        "mimetypes": [
            {
                mime: "application/octet-stream",
                filename: /\.pb$/i,
            },
            {
                mime: "application/x-protobuf",
                filename: /\.pb$/i,
            },
            { // Fallback for just filename if mime type is generic
                filename: /\.pb$/i,
            }
        ]
    }
]

export default HANDLERS
