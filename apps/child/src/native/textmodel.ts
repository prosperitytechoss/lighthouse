export type TextPrediction = { category: string; severity: string; confidence: number };

export type TextModel = {
  categories: string[];
  severities: string[];
  buckets: number;
  predict(text: string): TextPrediction | null;
  raw(text: string): { category: string; severity: string; confidence: number; sevConfidence: number } | null;
};

export const NULL_THRESHOLD = 0.5;
export const HYBRID_THRESHOLD = 0.85;

const MAX_CP = 300;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const P_WORD = 1;
const P_BIGRAM = 2;
const P_CHAR = 3;
const SPACE = 32;
const TOKEN_RE = /[\p{L}\p{Nd}\p{Nl}\p{No}\p{Mn}]/u;

function fnvByte(h: number, b: number): number {
  return Math.imul(h ^ b, FNV_PRIME) >>> 0;
}

function fnvCp(h: number, cp: number): number {
  if (cp < 0x80) return fnvByte(h, cp);
  if (cp < 0x800) return fnvByte(fnvByte(h, 0xc0 | (cp >> 6)), 0x80 | (cp & 0x3f));
  if (cp < 0x10000) {
    h = fnvByte(h, 0xe0 | (cp >> 12));
    h = fnvByte(h, 0x80 | ((cp >> 6) & 0x3f));
    return fnvByte(h, 0x80 | (cp & 0x3f));
  }
  h = fnvByte(h, 0xf0 | (cp >> 18));
  h = fnvByte(h, 0x80 | ((cp >> 12) & 0x3f));
  h = fnvByte(h, 0x80 | ((cp >> 6) & 0x3f));
  return fnvByte(h, 0x80 | (cp & 0x3f));
}

function isTokenCp(cp: number): boolean {
  if (cp < 0x80) return (cp >= 0x61 && cp <= 0x7a) || (cp >= 0x30 && cp <= 0x39) || (cp >= 0x41 && cp <= 0x5a);
  return TOKEN_RE.test(String.fromCodePoint(cp));
}

function isEmojiCp(cp: number): boolean {
  return (cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf);
}

type Norm = { cps: number[]; starts: number[]; ends: number[] };

function normalise(text: string): Norm {
  const cps: number[] = [SPACE];
  const starts: number[] = [];
  const ends: number[] = [];
  let inTok = false;
  let n = 0;
  for (const ch of text.toLowerCase()) {
    if (n >= MAX_CP) break;
    n++;
    const cp = ch.codePointAt(0)!;
    if (isTokenCp(cp)) {
      if (!inTok) {
        starts.push(cps.length);
        inTok = true;
      }
      cps.push(cp);
    } else {
      if (inTok) {
        ends.push(cps.length);
        cps.push(SPACE);
        inTok = false;
      }
      if (isEmojiCp(cp)) {
        starts.push(cps.length);
        cps.push(cp);
        ends.push(cps.length);
        cps.push(SPACE);
      }
    }
  }
  if (inTok) {
    ends.push(cps.length);
    cps.push(SPACE);
  }
  return { cps, starts, ends };
}

function hashRange(prefix: number, cps: number[], from: number, to: number, mask: number): number {
  let h = fnvByte(FNV_OFFSET, prefix);
  for (let i = from; i < to; i++) h = fnvCp(h, cps[i]!);
  return h & mask;
}

export function featurize(text: string, buckets: number): Map<number, number> {
  const mask = buckets - 1;
  const { cps, starts, ends } = normalise(text);
  const counts = new Map<number, number>();
  if (starts.length === 0) return counts;
  const bump = (b: number) => counts.set(b, (counts.get(b) ?? 0) + 1);
  for (let i = 0; i < starts.length; i++) bump(hashRange(P_WORD, cps, starts[i]!, ends[i]!, mask));
  for (let i = 0; i + 1 < starts.length; i++) bump(hashRange(P_BIGRAM, cps, starts[i]!, ends[i + 1]!, mask));
  const L = cps.length;
  const seed = fnvByte(FNV_OFFSET, P_CHAR);
  for (let i = 0; i < L; i++) {
    let h = seed;
    for (let k = 0; k < 5 && i + k < L; k++) {
      h = fnvCp(h, cps[i + k]!);
      if (k >= 2) bump(h & mask);
    }
  }
  let ss = 0;
  for (const v of counts.values()) ss += v * v;
  const inv = 1 / Math.sqrt(ss);
  for (const [b, v] of counts) counts.set(b, v * inv);
  return counts;
}

type Head = { n: number; scale: Float32Array; w: Int8Array; bias: Float32Array };

function readHead(dv: DataView, buf: ArrayBuffer, off: number, buckets: number, n: number): { head: Head; off: number } {
  const scale = new Float32Array(n);
  for (let i = 0; i < n; i++) scale[i] = dv.getFloat32(off + 4 * i, true);
  off += 4 * n;
  const w = new Int8Array(buf, off, buckets * n);
  off += buckets * n;
  const bias = new Float32Array(n);
  for (let i = 0; i < n; i++) bias[i] = dv.getFloat32(off + 4 * i, true);
  off += 4 * n;
  return { head: { n, scale, w, bias }, off };
}

function softmaxInto(z: Float64Array): number {
  let m = -Infinity;
  for (let i = 0; i < z.length; i++) if (z[i]! > m) m = z[i]!;
  let s = 0;
  for (let i = 0; i < z.length; i++) {
    z[i] = Math.exp(z[i]! - m);
    s += z[i]!;
  }
  let best = 0;
  for (let i = 0; i < z.length; i++) {
    z[i] = z[i]! / s;
    if (z[i]! > z[best]!) best = i;
  }
  return best;
}

function runHead(head: Head, feats: Map<number, number>): Float64Array {
  const acc = new Float64Array(head.n);
  for (const [b, v] of feats) {
    const base = b * head.n;
    for (let c = 0; c < head.n; c++) acc[c] = acc[c]! + v * head.w[base + c]!;
  }
  for (let c = 0; c < head.n; c++) acc[c] = acc[c]! * head.scale[c]! + head.bias[c]!;
  return acc;
}

export function loadTextModel(buf: ArrayBuffer): TextModel {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== "LHTM") throw new Error("textmodel: bad magic");
  const version = dv.getUint16(4, true);
  if (version !== 1) throw new Error(`textmodel: unsupported version ${version}`);
  const buckets = dv.getUint32(6, true);
  const nClasses = dv.getUint8(10);
  const nSev = dv.getUint8(11);
  let off = 12;
  const dec = new TextDecoder();
  const names: string[] = [];
  for (let i = 0; i < nClasses + nSev; i++) {
    const len = dv.getUint8(off);
    names.push(dec.decode(new Uint8Array(buf, off + 1, len)));
    off += 1 + len;
  }
  const categories = names.slice(0, nClasses);
  const severities = names.slice(nClasses);
  const cat = readHead(dv, buf, off, buckets, nClasses);
  const sev = readHead(dv, buf, cat.off, buckets, nSev);
  const safeIdx = categories.indexOf("SAFE");

  const raw = (text: string) => {
    if (!text) return null;
    const feats = featurize(text, buckets);
    if (feats.size === 0) return null;
    const pc = runHead(cat.head, feats);
    const ps = runHead(sev.head, feats);
    const ci = softmaxInto(pc);
    const si = softmaxInto(ps);
    return { category: categories[ci]!, severity: severities[si]!, confidence: pc[ci]!, sevConfidence: ps[si]! };
  };

  return {
    categories,
    severities,
    buckets,
    raw,
    predict(text: string) {
      const r = raw(text);
      if (!r) return null;
      if (categories.indexOf(r.category) === safeIdx || r.confidence < NULL_THRESHOLD) return null;
      return { category: r.category, severity: r.severity, confidence: r.confidence };
    },
  };
}
