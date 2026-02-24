/**
 * Download - File download utility for evidence export
 */
export function downloadTextFile(name, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    downloadBlob(name, blob);
}
export function downloadJsonFile(name, data) {
    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    downloadBlob(name, blob);
}
export function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
