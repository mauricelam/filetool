// Empty shims for Node.js built-in modules
export const fs = {};
export const path = {
    resolve: (...args) => args.join('/'),
    join: (...args) => args.join('/'),
    dirname: (path) => path.split('/').slice(0, -1).join('/'),
    basename: (path) => path.split('/').pop(),
};
export const crypto = {
    randomBytes: (size) => {
        const buffer = new Uint8Array(size);
        self.crypto.getRandomValues(buffer);
        return buffer;
    },
}; 