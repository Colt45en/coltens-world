export function nowMs() {
    return Date.now();
}
export function randomId(prefix) {
    const r = Math.random().toString(16).slice(2);
    return `${prefix}_${Date.now().toString(16)}_${r}`;
}
