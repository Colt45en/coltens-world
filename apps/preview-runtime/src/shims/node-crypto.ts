type HashDigestEncoding = "hex" | "base64";

function toBytes(input: string | Uint8Array): Uint8Array {
  if (typeof input === "string") {
    return new TextEncoder().encode(input);
  }
  return input;
}

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function deterministicHexHash(input: Uint8Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  let h3 = 0x811c9dc5;
  let h4 = 0x811c9dc5;

  for (let i = 0; i < input.length; i++) {
    const b = input[i]!;
    h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((b + i) & 0xff), 0x01000193) >>> 0;
    h3 = Math.imul(h3 ^ ((b * 3 + i) & 0xff), 0x01000193) >>> 0;
    h4 = Math.imul(h4 ^ ((b * 7 + i) & 0xff), 0x01000193) >>> 0;
  }

  const mix = (x: number): string => {
    const y = (x ^ (x >>> 16)) >>> 0;
    return y.toString(16).padStart(8, "0");
  };

  return `${mix(h1)}${mix(h2)}${mix(h3)}${mix(h4)}${mix(h1 ^ h3)}${mix(h2 ^ h4)}${mix(h1 ^ h2)}${mix(h3 ^ h4)}`;
}

class HashShim {
  private chunks: Uint8Array[] = [];

  update(data: string | Uint8Array, _encoding?: string): this {
    this.chunks.push(toBytes(data));
    return this;
  }

  digest(encoding: HashDigestEncoding = "hex"): string {
    const totalLen = this.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const merged = new Uint8Array(totalLen);

    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const hex = deterministicHexHash(merged);
    if (encoding === "base64") {
      return hexToBase64(hex);
    }
    return hex;
  }
}

export function createHash(_algorithm: string): HashShim {
  return new HashShim();
}

const cryptoShim = {
  createHash,
};

export default cryptoShim;
