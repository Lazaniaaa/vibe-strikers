// FNV-1a hash of a text, as an unsigned 32-bit number. Same result in every client and on the server.
export function textHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}
