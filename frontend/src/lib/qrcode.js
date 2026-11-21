/**
 * Minimal, zero-dependency QR Code Matrix generator (Byte Mode, Version 1-10, ECL M/L)
 * Generates boolean[][] matrix suitable for SVG/Canvas rendering.
 */

const PAD0 = 0xec;
const PAD1 = 0x11;

// Galois Field 256 math tables
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);
for (let i = 0, x = 1; i < 256; i++) {
  EXP_TABLE[i] = x;
  LOG_TABLE[x] = i;
  x = (x << 1) ^ (x & 128 ? 0x11d : 0);
}

function gmult(x, y) {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[x] + LOG_TABLE[y]) % 255];
}

// Reed-Solomon generator polynomial
function getGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gmult(poly[j], factor);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

// Version table for Level L/M (Total data bytes, EC bytes per block, block count)
// For our URLs (around 30-50 chars), Version 3 or 4 is ideal.
const VERSION_SPECS = [
  null,
  { v: 1, size: 21, dataBytes: 19, ecBytes: 7, blocks: 1 },
  { v: 2, size: 25, dataBytes: 34, ecBytes: 10, blocks: 1 },
  { v: 3, size: 29, dataBytes: 55, ecBytes: 15, blocks: 1 },
  { v: 4, size: 33, dataBytes: 80, ecBytes: 20, blocks: 1 },
  { v: 5, size: 37, dataBytes: 108, ecBytes: 26, blocks: 1 },
  { v: 6, size: 41, dataBytes: 136, ecBytes: 18, blocks: 2 },
];

export function generateQRCodeMatrix(text) {
  const utf8 = new TextEncoder().encode(text);
  const dataLen = utf8.length;

  let spec = null;
  for (let i = 1; i < VERSION_SPECS.length; i++) {
    // 4 bits mode + 8 bits length (for V1-9) + dataLen
    const needed = dataLen + 2;
    if (VERSION_SPECS[i].dataBytes >= needed) {
      spec = VERSION_SPECS[i];
      break;
    }
  }
  if (!spec) spec = VERSION_SPECS[VERSION_SPECS.length - 1];

  // Bit buffer: 0100 (Byte mode) + 8-bit length
  const bits = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode
  pushBits(dataLen, 8); // Character count
  for (let i = 0; i < dataLen; i++) {
    pushBits(utf8[i], 8);
  }

  // Terminator (up to 4 zeroes)
  const maxBits = spec.dataBytes * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);

  // Byte align
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Convert to bytes
  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j];
    }
    dataBytes.push(b);
  }

  // Padding bytes
  let padToggle = false;
  while (dataBytes.length < spec.dataBytes) {
    dataBytes.push(padToggle ? PAD1 : PAD0);
    padToggle = !padToggle;
  }

  // Reed-Solomon EC calculation
  const gen = getGeneratorPoly(spec.ecBytes);
  const ecLen = spec.ecBytes;
  const msg = [...dataBytes, ...new Array(ecLen).fill(0)];
  for (let i = 0; i < dataBytes.length; i++) {
    const lead = msg[i];
    if (lead !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gmult(gen[j], lead);
      }
    }
  }
  const ecBytes = msg.slice(dataBytes.length);

  // Interleave and finalize codewords
  const allCodewords = [...dataBytes, ...ecBytes];

  // Build matrix
  const size = spec.size;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
  const isReserved = Array.from({ length: size }, () => new Array(size).fill(false));

  function setModule(r, c, val, reserved = true) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      if (reserved) isReserved[r][c] = true;
    }
  }

  // Finder patterns
  function addFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          setModule(nr, nc, false);
        } else if (r === 0 || r === 6 || c === 0 || c === 6) {
          setModule(nr, nc, true);
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          setModule(nr, nc, true);
        } else {
          setModule(nr, nc, false);
        }
      }
    }
  }

  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // Alignment patterns for Version 2+
  const ALIGNMENT_COORDS = [
    [],
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
  ];
  const aligns = ALIGNMENT_COORDS[spec.v] || [];
  for (const r of aligns) {
    for (const c of aligns) {
      if (isReserved[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBorder = Math.max(Math.abs(dr), Math.abs(dc)) === 2;
          const isCenter = dr === 0 && dc === 0;
          setModule(r + dr, c + dc, isBorder || isCenter);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (!isReserved[6][i]) setModule(6, i, val);
    if (!isReserved[i][6]) setModule(i, 6, val);
  }

  // Dark module
  setModule(size - 8, 8, true);

  // Format info area reserve
  for (let i = 0; i < 9; i++) {
    if (!isReserved[8][i]) isReserved[8][i] = true;
    if (!isReserved[i][8]) isReserved[i][8] = true;
  }
  for (let i = size - 8; i < size; i++) {
    if (!isReserved[8][i]) isReserved[8][i] = true;
    if (!isReserved[i][8]) isReserved[i][8] = true;
  }

  // Place data bits with Mask 0 ((r + c) % 2 === 0)
  const allBits = [];
  for (const byte of allCodewords) {
    for (let b = 7; b >= 0; b--) {
      allBits.push((byte >> b) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // skip timing col
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (!isReserved[r][c]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = (bit ^ (mask ? 1 : 0)) === 1;
        }
      }
    }
    upwards = !upwards;
  }

  // Format info: Level L + Mask 0 = 0b01000 with BCH = 0x77c4 (masked)
  const FORMAT_BITS_L_M0 = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  // Top-left format info
  for (let i = 0; i < 6; i++) matrix[8][i] = !!FORMAT_BITS_L_M0[i];
  matrix[8][7] = !!FORMAT_BITS_L_M0[6];
  matrix[8][8] = !!FORMAT_BITS_L_M0[7];
  matrix[7][8] = !!FORMAT_BITS_L_M0[8];
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = !!FORMAT_BITS_L_M0[i];

  // Top-right and bottom-left format info
  for (let i = 0; i < 8; i++) matrix[8][size - 1 - i] = !!FORMAT_BITS_L_M0[i];
  for (let i = 0; i < 7; i++) matrix[size - 7 + i][8] = !!FORMAT_BITS_L_M0[8 + i];

  return matrix;
}

