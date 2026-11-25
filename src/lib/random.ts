/** Unbiased random integer in [0, max). Uses the platform CSPRNG when available. */
export function randomIndex(max: number): number {
  if (globalThis.crypto?.getRandomValues) {
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    do globalThis.crypto.getRandomValues(buf);
    while (buf[0] >= limit);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/** Uniform float in [0, 1) with 53 bits of randomness. */
export function randomFloat(): number {
  if (globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(2);
    globalThis.crypto.getRandomValues(buf);
    return (buf[0] * 2 ** 21 + (buf[1] >>> 11)) / 2 ** 53;
  }
  return Math.random();
}

/** Random integer in [min, max], inclusive. */
export const randomInt = (min: number, max: number) => min + randomIndex(max - min + 1);

export const LEVEL_MIN = 30;
export const LEVEL_MAX = 280;
export const randomLevel = () => randomInt(LEVEL_MIN, LEVEL_MAX);
