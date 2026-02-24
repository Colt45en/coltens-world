/**
 * Crypto utilities - SHA-256 and base64 encoding
 */
export async function sha256HexFromString(s) {
    const buf = new TextEncoder().encode(s);
    const ab = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(ab)).map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function sha256HexFromBytes(bytes) {
    const ab = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
    return Array.from(new Uint8Array(ab)).map(b => b.toString(16).padStart(2, "0")).join("");
}
export function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes.at(i) ?? 0);
    }
    return btoa(binary);
}
export function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
export async function dataUrlToBytes(dataUrl) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match || !match[2])
        throw new Error("Invalid data URL");
    return base64ToBytes(match[2]);
}
