// Test just the crypto functions without zod
function toHex32(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}

function bytesToHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function utf8(text) {
  return new TextEncoder().encode(text);
}

function sha256HexSync(message) {
  // SHA-256 constants
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const data = utf8(message);
  const bitLenHi = Math.floor((data.length * 8) / 0x100000000);
  const bitLenLo = (data.length * 8) >>> 0;

  // Pre-processing: padding
  const withOne = data.length + 1;
  const padLen = (withOne % 64 <= 56) ? (56 - (withOne % 64)) : (56 + (64 - (withOne % 64)));
  const totalLen = data.length + 1 + padLen + 8;

  const buf = new Uint8Array(totalLen);
  buf.set(data, 0);
  buf[data.length] = 0x80; // append '1' bit

  // append length (big endian 64-bit)
  const dv = new DataView(buf.buffer);
  dv.setUint32(totalLen - 8, bitLenHi, false);
  dv.setUint32(totalLen - 4, bitLenLo, false);

  const W = new Uint32Array(64);

  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const ch = (x, y, z) => (x & y) ^ (~x & z);
  const maj = (x, y, z) => (x & y) ^ (x & z) ^ (y & z);
  const s0 = (x) => rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
  const s1 = (x) => rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10);
  const S0 = (x) => rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22);
  const S1 = (x) => rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25);

  for (let i = 0; i < buf.length; i += 64) {
    // message schedule
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const v = (s1(W[t - 2]) + W[t - 7] + s0(W[t - 15]) + W[t - 16]) >>> 0;
      W[t] = v;
    }

    // working vars
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let t = 0; t < 64; t++) {
      const T1 = (h + S1(e) + ch(e, f, g) + K[t] + W[t]) >>> 0;
      const T2 = (S0(a) + maj(a, b, c)) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + T1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (T1 + T2) >>> 0;
    }

    // add back
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return (
    toHex32(h0) + toHex32(h1) + toHex32(h2) + toHex32(h3) +
    toHex32(h4) + toHex32(h5) + toHex32(h6) + toHex32(h7)
  );
}

// Initial hash values
let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

// Test SHA-256
const hash = sha256HexSync('abc');
console.log('SHA-256 test:', hash === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' ? 'PASS' : 'FAIL');
console.log('Hash:', hash);
