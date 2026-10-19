/* Public HTTP preview needs IDs and SHA-256, but native Web Crypto APIs
 * other than getRandomValues are restricted to secure contexts. Keep native
 * implementations intact; this does not enable microphone or device access. */
(() => {
  'use strict';
  const crypto = globalThis.crypto;
  if (!crypto) return;
  if (typeof crypto.randomUUID !== 'function' && typeof crypto.getRandomValues === 'function') {
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value() {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } });
  }
  if (!crypto.subtle && typeof globalThis.sha256 === 'function') {
    Object.defineProperty(crypto, 'subtle', { configurable: true, value: {
      // The public application only uses SHA-256 digests for draft/source bindings.
      async digest(algorithm, data) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;
        if (typeof name !== 'string' || name.toUpperCase() !== 'SHA-256') {
          throw new DOMException('Only SHA-256 is supported by the HTTP preview.', 'NotSupportedError');
        }
        let bytes;
        if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
        else throw new TypeError('Expected an ArrayBuffer or ArrayBuffer view.');
        return globalThis.sha256.arrayBuffer(bytes);
      }
    } });
  }
})();
