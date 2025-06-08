// Simple MimeType Inference (can be expanded)
export const inferMimeType = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension) return 'application/octet-stream';

    // Prioritize specific known types that might be in APKs
    // and are distinct from generic text/xml for binary XML.
    switch (extension) {
        case 'png': return 'image/png';
        case 'jpg': case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
        case 'svg': return 'image/svg+xml'; // XML-based, but distinct rendering
        case 'xml': // Could be binary XML or plain XML. Default to application/xml for previews.
                    // Actual binary XML files are often named AndroidManifest.xml, layouts, etc.
                    // The decode_apk process already converts known binary XMLs to strings.
                    // So, if it's still a Uint8Array named .xml, it might be some other raw XML.
            return 'application/xml';
        case 'dex': return 'application/vnd.android.dex'; // Specific for .dex files
        case 'arsc': return 'application/vnd.android.arsc'; // Specific for .arsc files
        // Common text types often found
        case 'txt': return 'text/plain';
        case 'json': return 'application/json';
        case 'html': return 'text/html';
        case 'js': return 'application/javascript';
        case 'css': return 'text/css';
        // Add more common types as needed
        default: return 'application/octet-stream';
    }
};
