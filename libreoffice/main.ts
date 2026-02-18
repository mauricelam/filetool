// Emscripten Module declaration
declare global {
    interface Window {
        Module: any;
    }
}

const statusContainer = document.getElementById('status-container');
const messageEl = document.getElementById('message');
const progressFill = document.getElementById('progress-fill');

function updateStatus(text: string, progress?: number) {
    if (text && messageEl) messageEl.textContent = text;
    if (progress !== undefined && progressFill) {
        progressFill.style.width = progress + '%';
    }
    if (!text && !progress) {
        statusContainer?.classList.add('hidden');
    } else {
        statusContainer?.classList.remove('hidden');
    }
}

// Emscripten Module configuration
window.Module = {
    canvas: document.getElementById('qtcanvas'),

    print: (text: string) => console.log('[LibreOffice STDOUT]:', text),
    printErr: (text: string) => console.warn('[LibreOffice STDERR]:', text),

    locateFile: (path: string, prefix: string) => {
        // Point to the assets directory for WASM and data files
        if (path.endsWith('.wasm') || path.endsWith('.js') || path.endsWith('.data')) {
            return '/filetool/assets/libreoffice/' + path;
        }
        return prefix + path;
    },

    setStatus: (text: string) => {
        const m = text.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
        if (m) {
            const progress = (parseInt(m[2]) / parseInt(m[4])) * 100;
            updateStatus(m[1].trim(), progress);
        } else {
            updateStatus(text);
        }
    },

    onAbort: (msg: string) => {
        console.error('LibreOffice WASM Aborted:', msg);
        window.parent.postMessage({
            type: 'ERROR',
            message: 'LibreOffice WASM aborted: ' + msg
        }, '*');
    },

    onRuntimeInitialized: async () => {
        console.log('LibreOffice Runtime Initialized');
        isRuntimeInitialized = true;
        updateStatus('', 0); // Hide status

        if (pendingFile) {
            console.log('Processing buffered file:', pendingFile.name);
            await openFile(pendingFile.blob, pendingFile.name);
            pendingFile = null;
        }
    }
};

// Error Proxying
window.onerror = (msg, url, line, col, error) => {
    const errorMessage = `LibreOffice Error: ${msg} (${url}:${line})`;
    window.parent.postMessage({ type: 'ERROR', message: errorMessage }, '*');
    return false;
};

let pendingFile: { blob: Blob, name: string } | null = null;
let isRuntimeInitialized = false;

async function openFile(fileBlob: Blob, fileName: string) {
    const Module = window.Module;
    try {
        updateStatus(`Opening ${fileName}...`);

        const arrayBuffer = await fileBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Write the file to Emscripten's virtual file system (MEMFS)
        if (Module.FS) {
            // Ensure we use a clean path
            const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            Module.FS.writeFile(safeFileName, uint8Array);
            console.log(`Saved ${safeFileName} to Emscripten FS (${uint8Array.length} bytes)`);

            // Call LibreOffice to open the file
            if (Module.callMain) {
                // We use common CLI args for viewing/editing
                Module.callMain([safeFileName]);
            } else {
                throw new Error('Module.callMain is not available');
            }
        } else {
            throw new Error('Emscripten FS is not initialized');
        }
    } catch (err: any) {
        console.error('Failed to open file:', err);
        window.parent.postMessage({
            type: 'ERROR',
            message: 'Failed to open file: ' + err.message
        }, '*');
    } finally {
        updateStatus('', 0);
    }
}

// PostMessage API: Listen for files from the parent window
window.addEventListener('message', async (event) => {
    const data = event.data;

    // Support the standard 'respondFile' protocol
    if (data.action === 'respondFile') {
        const fileBlob = data.file;
        const fileName = data.file ? data.file.name : 'document.xlsx';

        if (!fileBlob) {
            console.error('Received message without file data');
            return;
        }

        if (isRuntimeInitialized) {
            await openFile(fileBlob, fileName);
        } else {
            console.log('Buffering file until LibreOffice is ready...');
            pendingFile = { blob: fileBlob, name: fileName };
            updateStatus(`Waiting for LibreOffice to load ${fileName}...`);
        }
    }
});

// Request file from parent (standard filetool behavior)
if (window.parent && window.parent !== window) {
    window.parent.postMessage({ action: 'requestFile' }, '*');
}

// Clean Shutdown
window.addEventListener('unload', () => {
    if (window.Module && window.Module.exit) {
        console.log('Attempting clean shutdown of LibreOffice WASM');
        window.Module.exit();
    }
});
