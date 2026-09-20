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

const files = walk('node_modules/@silurus/ooxml/dist');
for (const file of files) {
    let code = fs.readFileSync(file, 'utf8');
    const origCode = code;

    code = code.replace(/(\b[a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*\.resource_usage\(\))/g, (match, expr) => {
        return `(function(){ try { return ${expr}; } catch(err) { if (String(err).includes("resource usage is unavailable")) return new Uint8Array(); throw err; } })()`;
    });

    if (code !== origCode) {
        fs.writeFileSync(file, code);
        console.log('[patch-ooxml] Patched:', file);
    }
}
