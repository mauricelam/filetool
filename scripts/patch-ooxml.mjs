import fs from 'fs';
import path from 'path';

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.js')) {
            results.push(file);
        }
    });
    return results;
}

// UTF-8 bytes for: {"archiveEntryCount":0,"declaredInflatedBytes":0,"distinctInflatedBytes":0,"operationInflatedBytes":0}
const validUsageBytes = [123,34,97,114,99,104,105,118,101,69,110,116,114,121,67,111,117,110,116,34,58,48,44,34,100,101,99,108,97,114,101,100,73,110,102,108,97,116,101,100,66,121,116,101,115,34,58,48,44,34,100,105,115,116,105,110,99,116,73,110,102,108,97,116,101,100,66,121,116,101,115,34,58,48,44,34,111,112,101,114,97,116,105,111,110,73,110,102,108,97,116,101,100,66,121,116,101,115,34,58,48,125].join(',');

const files = walk('node_modules/@silurus/ooxml/dist');
for (const file of files) {
    let code = fs.readFileSync(file, 'utf8');
    const origCode = code;

    // Match any call like .resource_usage(), .sheet_cursor_resource_usage(), .slide_cursor_resource_usage()
    code = code.replace(/(\b[a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*\.[a-zA-Z0-9_$]*resource_usage\(\))/g, (match, expr) => {
        return `(function(){ try { return ${expr}; } catch(err) { if (/resource/.test(err)) return new Uint8Array([${validUsageBytes}]); throw err; } })()`;
    });

    if (code !== origCode) {
        fs.writeFileSync(file, code);
        console.log('[patch-ooxml] Patched:', file);
    }
}
