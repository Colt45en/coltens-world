import fs, { access } from "node:fs/promises";
import { constants } from "node:fs";
import type { NdjsonIO, NdjsonTailIO } from "../index.js";

export const nodeIO: NdjsonIO & NdjsonTailIO = {
  async readText(path: string) {
    return await fs.readFile(path, "utf8");
  },
  async appendText(path: string, content: string) {
    await fs.appendFile(path, content, "utf8");
  },
  async writeText(path: string, content: string) {
    await fs.writeFile(path, content, "utf8");
  },
  async exists(path: string) {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  },

  async readBytes(path: string, byteOffset: number, maxBytes = 1 << 20) {
    const fh = await fs.open(path, "r");
    try {
      const stat = await fh.stat();
      const fileSize = stat.size;
      if (byteOffset >= fileSize) {
        return { text: "", newOffset: byteOffset, eof: true };
      }

      const toRead = Math.min(maxBytes, fileSize - byteOffset);
      const buf = Buffer.allocUnsafe(toRead);
      const { bytesRead } = await fh.read(buf, 0, toRead, byteOffset);

      const text = buf.subarray(0, bytesRead).toString("utf8");
      const newOffset = byteOffset + bytesRead;
      const eof = newOffset >= fileSize;

      return { text, newOffset, eof };
    } finally {
      await fh.close();
    }
  },
};
