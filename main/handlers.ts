export default [
    {
        "name": "Hex",
        "handler": "/hex_viewer",
        "mimetypes": [
            /.*/
        ]
    },
    {
        "name": "Browser",
        "handler": "__browser__",
        "mimetypes": [
            "video/3gpp",
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
        "name": "Text Viewer",
        "handler": "__text__",
        "mimetypes": [
            /text\/.*/,
            "message/rfc822",
            "image/svg+xml",
            "application/json",
        ]
    },
    {
        "name": "Webassembly text viewer",
        "handler": "/wat_viewer",
        "mimetypes": [
            "application/wasm",
        ]
    },
    {
        "name": "Open archive",
        "handler": "/archive",
        "mimetypes": [
            "application/zip",
            "application/gzip",
            "application/x-xz",
            "application/vnd.android.package-archive",  // APK
            "application/x-rar",
            "application/x-7z-compressed",
        ]
    },
    {
        "name": "ClassyShark",
        "handler": "/classyshark",
        "mimetypes": [
            "application/vnd.android.package-archive",
            {
                "mime": "application/zip",
                "filename": /.*\.jar|.*\.aar/i,
            }
        ]
    },
    {
        "name": "Android binary viewer",
        "handler": "/binaryxml",
        "mimetypes": [
            "application/vnd.android.package-archive"
        ]
    },
    {
        "name": "Binutils",
        "handler": "/binutils",
        "mimetypes": [
            "application/x-mach-binary",
            "application/x-executable",
        ]
    },
    {
        "name": "ImageMagick",
        "handler": "/imagemagick",
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
            {
                "mime": "application/octet-stream",
                "filename": /.*\.raw/i,
            },
            "font/sfnt",
            "image/apng",
            "image/avif",
        ]
    }
]
