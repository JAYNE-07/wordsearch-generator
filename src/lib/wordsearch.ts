// Place words on a letter grid for word-search puzzles.
//
// Directions: 0=right (→), 1=down (↓), 2=down-right (↘), 3=up-right (↗).
// No reversed words. Words longer than `cols` or containing non-letters are
// rejected. Empty cells get filled with random uppercase letters using the
// same seeded RNG so output is fully deterministic per (seed, words, size).

export type Direction = 0 | 1 | 2 | 3;

export interface Placement {
  word: string;
  row: number;
  col: number;
  dir: Direction;
}

export interface WordSearch {
  cols: number;
  rows: number;
  grid: string[][];
  placements: Placement[];
  placed: string[];
}

const DR: Record<Direction, number> = { 0: 0, 1: 1, 2: 1, 3: -1 };
const DC: Record<Direction, number> = { 0: 1, 1: 0, 2: 1, 3: 1 };

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tryPlace(
  grid: string[][],
  word: string,
  row: number,
  col: number,
  dir: Direction,
  cols: number,
  rows: number,
): boolean {
  const dr = DR[dir];
  const dc = DC[dir];
  // Bounds check first cheaply with the endpoint.
  const endR = row + dr * (word.length - 1);
  const endC = col + dc * (word.length - 1);
  if (endR < 0 || endR >= rows || endC < 0 || endC >= cols) return false;
  // Conflict check: only matching letters are allowed to coincide.
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = grid[r][c];
    if (existing && existing !== word[i]) return false;
  }
  // Commit.
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    grid[r][c] = word[i];
  }
  return true;
}

export function placeWords(
  words: string[],
  cols: number,
  rows: number,
  seed: number,
): WordSearch {
  const rng = mulberry32(seed || 1);
  const grid: string[][] = Array.from({ length: rows }, () =>
    new Array<string>(cols).fill(''),
  );
  const placements: Placement[] = [];
  const placed: string[] = [];

  for (const raw of words) {
    const word = raw.toUpperCase();
    if (!/^[A-Z]+$/.test(word)) continue;
    if (word.length > cols) continue;

    let success = false;
    for (let attempt = 0; attempt < 200 && !success; attempt++) {
      const dir = Math.floor(rng() * 4) as Direction;
      // Constrain start to keep the word in bounds for this direction.
      const dr = DR[dir];
      const dc = DC[dir];
      const minR = dr === 0 ? 0 : dr > 0 ? 0 : word.length - 1;
      const maxR = dr === 0 ? rows - 1 : dr > 0 ? rows - word.length : rows - 1;
      const minC = dc === 0 ? 0 : dc > 0 ? 0 : word.length - 1;
      const maxC = dc === 0 ? cols - 1 : dc > 0 ? cols - word.length : cols - 1;
      const row = minR + Math.floor(rng() * (maxR - minR + 1));
      const col = minC + Math.floor(rng() * (maxC - minC + 1));
      if (tryPlace(grid, word, row, col, dir, cols, rows)) {
        placements.push({ word, row, col, dir });
        placed.push(word);
        success = true;
      }
    }
  }

  // Fill remaining empty cells with random uppercase letters.
  const A = 'A'.charCodeAt(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) {
        grid[r][c] = String.fromCharCode(A + Math.floor(rng() * 26));
      }
    }
  }

  return { cols, rows, grid, placements, placed };
}

export function placementEnd(p: Placement): { row: number; col: number } {
  return {
    row: p.row + DR[p.dir] * (p.word.length - 1),
    col: p.col + DC[p.dir] * (p.word.length - 1),
  };
}
