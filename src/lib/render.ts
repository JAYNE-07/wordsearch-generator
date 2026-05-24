import type { Placement, WordSearch } from './wordsearch';

export interface GridOpts {
  cell: number;
  /** Where the grid is drawn (0,0 by default). */
  x?: number;
  y?: number;
  /** Letter / line palette. */
  ink?: string;
  line?: string;
  bg?: string;
  fontFamily?: string;
}

export interface ListOpts {
  x: number;
  y: number;
  width: number;
  columns?: number;
  fontSize?: number;
  ink?: string;
  fontFamily?: string;
}

export interface AnswerOpts extends GridOpts {
  /** Palette for the highlight capsules — cycles per word. */
  highlightColors?: string[];
}

const DEFAULT_INK = '#0b1220';
const DEFAULT_LINE = '#0b1220';
const DEFAULT_FONT = "'Courier New', Courier, monospace";
const HIGHLIGHTS = [
  'rgba(56, 189, 248, 0.45)', // cyan
  'rgba(244, 114, 182, 0.45)', // pink
  'rgba(34, 197, 94, 0.45)', // green
  'rgba(251, 191, 36, 0.5)', // amber
  'rgba(168, 85, 247, 0.45)', // violet
  'rgba(239, 68, 68, 0.45)', // red
  'rgba(14, 165, 233, 0.45)', // sky
  'rgba(132, 204, 22, 0.45)', // lime
];

const DR_LOOKUP = [0, 1, 1, -1];
const DC_LOOKUP = [1, 0, 1, 1];

export function gridPixelSize(puzzle: WordSearch, cell: number) {
  return {
    width: puzzle.cols * cell,
    height: puzzle.rows * cell,
  };
}

export function renderPuzzle(
  ctx: CanvasRenderingContext2D,
  puzzle: WordSearch,
  opts: GridOpts,
) {
  const cell = opts.cell;
  const ox = opts.x ?? 0;
  const oy = opts.y ?? 0;
  const ink = opts.ink ?? DEFAULT_INK;
  const line = opts.line ?? DEFAULT_LINE;
  const font = opts.fontFamily ?? DEFAULT_FONT;
  const { width, height } = gridPixelSize(puzzle, cell);

  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(ox, oy, width, height);
  }

  // Faint inner grid lines.
  ctx.save();
  ctx.strokeStyle = line;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = Math.max(0.5, cell * 0.04);
  ctx.beginPath();
  for (let c = 1; c < puzzle.cols; c++) {
    const x = ox + c * cell;
    ctx.moveTo(x, oy);
    ctx.lineTo(x, oy + height);
  }
  for (let r = 1; r < puzzle.rows; r++) {
    const y = oy + r * cell;
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + width, y);
  }
  ctx.stroke();
  ctx.restore();

  // Outer border.
  ctx.save();
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1.5, cell * 0.1);
  ctx.strokeRect(ox, oy, width, height);
  ctx.restore();

  // Letters.
  const fs = Math.round(cell * 0.62);
  ctx.fillStyle = ink;
  ctx.font = `bold ${fs}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const ch = puzzle.grid[r][c];
      if (!ch) continue;
      ctx.fillText(ch, ox + c * cell + cell / 2, oy + r * cell + cell / 2 + 1);
    }
  }
}

export function renderWordList(
  ctx: CanvasRenderingContext2D,
  words: string[],
  opts: ListOpts,
) {
  const columns = opts.columns ?? 2;
  const fontSize = opts.fontSize ?? 14;
  const ink = opts.ink ?? DEFAULT_INK;
  const font = opts.fontFamily ?? DEFAULT_FONT;
  const lineHeight = Math.round(fontSize * 1.55);
  const colWidth = opts.width / columns;

  ctx.save();
  ctx.fillStyle = ink;
  ctx.font = `bold ${fontSize}px ${font}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const rows = Math.ceil(words.length / columns);
  for (let i = 0; i < words.length; i++) {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = opts.x + col * colWidth;
    const y = opts.y + row * lineHeight;
    ctx.fillText(words[i], x, y);
  }
  ctx.restore();
}

/** Draw a translucent capsule from the first letter to the last letter of
 *  each placed word so the answer key reads at a glance. */
export function renderAnswerKey(
  ctx: CanvasRenderingContext2D,
  puzzle: WordSearch,
  placements: Placement[],
  opts: AnswerOpts,
) {
  const cell = opts.cell;
  const ox = opts.x ?? 0;
  const oy = opts.y ?? 0;
  const palette = opts.highlightColors ?? HIGHLIGHTS;

  ctx.save();
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    drawHighlight(ctx, p, cell, ox, oy, palette[i % palette.length]);
  }
  ctx.restore();

  // Letters and grid on top so they stay legible.
  renderPuzzle(ctx, puzzle, opts);
}

function drawHighlight(
  ctx: CanvasRenderingContext2D,
  p: Placement,
  cell: number,
  ox: number,
  oy: number,
  color: string,
) {
  const dr = DR_LOOKUP[p.dir];
  const dc = DC_LOOKUP[p.dir];
  const startX = ox + p.col * cell + cell / 2;
  const startY = oy + p.row * cell + cell / 2;
  const endX = ox + (p.col + dc * (p.word.length - 1)) * cell + cell / 2;
  const endY = oy + (p.row + dr * (p.word.length - 1)) * cell + cell / 2;
  const thickness = cell * 0.78;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();
}

/** Render a self-contained puzzle page (title + grid + word list) to a fresh
 *  white canvas suitable for PDF/PNG export. */
export function renderPuzzlePage(
  puzzle: WordSearch,
  cell: number,
  title: string,
  opts: { answerKey?: boolean } = {},
): HTMLCanvasElement {
  const { width: gw, height: gh } = gridPixelSize(puzzle, cell);
  const titleH = Math.max(48, cell * 2.4);
  const padX = Math.round(cell * 0.6);
  const listFs = Math.max(14, Math.round(cell * 0.55));
  const listLineH = Math.round(listFs * 1.55);
  const listColumns = 3;
  const listRows = Math.ceil(puzzle.placed.length / listColumns);
  const listH = listRows * listLineH + Math.round(cell * 1.2);

  const canvas = document.createElement('canvas');
  canvas.width = gw + padX * 2;
  canvas.height = titleH + gh + listH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title.
  const ts = Math.max(22, Math.min(40, cell * 1.4));
  ctx.fillStyle = DEFAULT_INK;
  ctx.font = `bold ${ts}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, titleH * 0.55);

  // Grid.
  const gx = (canvas.width - gw) / 2;
  const gy = titleH;
  if (opts.answerKey) {
    renderAnswerKey(ctx, puzzle, puzzle.placements, { cell, x: gx, y: gy });
  } else {
    renderPuzzle(ctx, puzzle, { cell, x: gx, y: gy });
  }

  // Word list below.
  renderWordList(ctx, puzzle.placed, {
    x: padX,
    y: titleH + gh + Math.round(cell * 0.8),
    width: canvas.width - padX * 2,
    columns: listColumns,
    fontSize: listFs,
  });

  return canvas;
}
