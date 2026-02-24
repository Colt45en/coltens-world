// Deterministic RNG (xorshift32)
export class XorShift32 {
  private state: number;

  constructor(seed: number) {
    // force uint32, avoid zero state
    const s = seed >>> 0;
    this.state = s === 0 ? 0x6d2b79f5 : s;
  }

  nextU32(): number {
    let x = this.state >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  next01(): number {
    // 24-bit mantissa style
    return (this.nextU32() >>> 8) / 0x01000000;
  }
}
