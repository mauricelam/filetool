const nodeCrypto = require('crypto');

// Ensure global.crypto and globalThis.crypto are defined and have getRandomValues
if (typeof global.crypto !== 'object') {
  global.crypto = {};
}
if (typeof globalThis.crypto !== 'object') {
  globalThis.crypto = {};
}

if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = function getRandomValues(typedArray) {
    if (!(typedArray instanceof Uint8Array ||
          typedArray instanceof Int8Array ||
          typedArray instanceof Uint16Array ||
          typedArray instanceof Int16Array ||
          typedArray instanceof Uint32Array ||
          typedArray instanceof Int32Array ||
          typedArray instanceof BigUint64Array ||
          typedArray instanceof BigInt64Array)) {
      throw new TypeError('Argument 1 of Crypto.getRandomValues does not implement an ArrayBufferView');
    }
    const buffer = nodeCrypto.randomBytes(typedArray.byteLength);
    typedArray.set(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
    return typedArray;
  };
}

// Ensure globalThis.crypto.getRandomValues also points to this, in case wasm_exec.js specifically uses globalThis
if (typeof globalThis.crypto.getRandomValues !== 'function') {
    globalThis.crypto.getRandomValues = global.crypto.getRandomValues;
}


// Existing polyfills/mocks
global.self = {
  onmessage: null,
  postMessage: jest.fn(),
};

global.File = class MockFile {
  constructor(content, name, options) {
    if (Array.isArray(content) && content[0] instanceof Uint8Array) {
        this.contentBytes = content[0];
    } else if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
        this.contentBytes = content;
    } else {
        this.contentBytes = new Uint8Array();
    }
    this.name = name;
    this.options = options || { type: '' };
  }

  arrayBuffer() {
    if (this.contentBytes instanceof ArrayBuffer) {
        return Promise.resolve(this.contentBytes);
    }
    const uint8Array = this.contentBytes instanceof Uint8Array ? this.contentBytes : new Uint8Array(this.contentBytes);
    return Promise.resolve(uint8Array.buffer);
  }

  get type() {
    return this.options.type;
  }
};
