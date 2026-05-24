import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { placeWords, type WordSearch } from './wordsearch';
import { renderPuzzlePage } from './render';
import { wordsForTheme } from './themes';

export type PageSize = 'a4' | '5x8' | '6x9';

export interface BookPuzzle {
  puzzle: WordSearch;
  /** Title shown on the puzzle/answer page (e.g. "Puzzle 1"). */
  index: number;
}

const PAGE_FORMATS: Record<PageSize, 'a4' | [number, number]> = {
  a4: 'a4',
  '5x8': [5 * 72, 8 * 72],
  '6x9': [6 * 72, 9 * 72],
};

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

const slugify = (s: string) =>
  s.trim().replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '') ||
  'wordsearch';

const titleCase = (s: string) =>
  s.trim().replace(/\b\w/g, (m) => m.toUpperCase());

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface BatchOpts {
  cols?: number;
  rows?: number;
  wordsPerPuzzle?: number;
}

/**
 * Build `count` puzzles for a theme. Each puzzle gets its own seeded word
 * shuffle so the same theme produces varied subsets across the book.
 */
export async function generateBatch(
  theme: string,
  baseSeed: number,
  count: number,
  opts: BatchOpts = {},
  onProgress?: (done: number, total: number) => void,
): Promise<{ book: BookPuzzle[]; warnings: string[] }> {
  const cols = opts.cols ?? 18;
  const rows = opts.rows ?? 18;
  const wordsPerPuzzle = opts.wordsPerPuzzle ?? 14;
  const book: BookPuzzle[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < count; i++) {
    // Two seeds so the word pick and placement RNG don't collapse together.
    const wordSeed = ((baseSeed + i * 9176) >>> 0) || 1;
    const placeSeed = ((baseSeed ^ (i * 2654435761)) >>> 0) || 7;
    const words = wordsForTheme(theme, wordsPerPuzzle, wordSeed);
    if (words.length < wordsPerPuzzle) {
      warnings.push(
        `Puzzle ${i + 1}: only ${words.length}/${wordsPerPuzzle} usable words for "${theme}".`,
      );
    }
    const puzzle = placeWords(words, cols, rows, placeSeed);
    book.push({ puzzle, index: i });
    onProgress?.(i + 1, count);
    // Yield to the UI thread every few puzzles so the progress bar renders
    // instead of the browser appearing frozen.
    if ((i + 1) % 5 === 0) await tick();
  }

  return { book, warnings };
}

function placeCanvas(pdf: jsPDF, canvas: HTMLCanvasElement) {
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = Math.max(28, pw * 0.06);
  const availW = pw - margin * 2;
  const availH = ph - margin * 2;
  const scale = Math.min(availW / canvas.width, availH / canvas.height);
  const w = canvas.width * scale;
  const h = canvas.height * scale;
  const x = (pw - w) / 2;
  const y = (ph - h) / 2;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h, undefined, 'FAST');
}

export type AnswerLayout = 'interleaved' | 'end';

export async function exportBookPdf(
  book: BookPuzzle[],
  theme: string,
  pageSize: PageSize,
  onProgress: (done: number, total: number) => void,
  answerLayout: AnswerLayout = 'end',
) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: PAGE_FORMATS[pageSize],
  });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const name = titleCase(theme);
  const CELL = pageSize === '5x8' ? 22 : pageSize === '6x9' ? 24 : 26;

  // Cover page (jsPDF starts with one blank page).
  const coverTitle = Math.min(52, pw * 0.11);
  const coverSub = Math.min(16, pw * 0.038);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(coverTitle);
  pdf.text(`${name.toUpperCase()}`, pw / 2, ph * 0.4, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(Math.min(28, pw * 0.07));
  pdf.text('WORD SEARCH', pw / 2, ph * 0.4 + coverTitle * 0.95, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(coverSub);
  pdf.text(
    `${book.length} puzzles  ·  ${
      answerLayout === 'interleaved'
        ? 'answer follows each puzzle'
        : 'answer key at the back'
    }`,
    pw / 2,
    ph * 0.4 + coverTitle * 0.95 + coverSub * 2.4,
    { align: 'center' },
  );

  const total = book.length * 2; // puzzle pages + answer pages
  let done = 0;
  const fmt = PAGE_FORMATS[pageSize];

  if (answerLayout === 'interleaved') {
    // Puzzle then its own answer, repeated for every puzzle.
    for (let i = 0; i < book.length; i++) {
      const { puzzle } = book[i];
      pdf.addPage(fmt, 'portrait');
      placeCanvas(pdf, renderPuzzlePage(puzzle, CELL, `Puzzle ${i + 1}`));
      done++;
      onProgress(done, total);
      pdf.addPage(fmt, 'portrait');
      placeCanvas(
        pdf,
        renderPuzzlePage(puzzle, CELL, `Answer ${i + 1}`, { answerKey: true }),
      );
      done++;
      onProgress(done, total);
      if (i % 4 === 0) await tick();
    }
  } else {
    // All puzzles first, then an "ANSWER KEY" divider, then all answers.
    for (let i = 0; i < book.length; i++) {
      const { puzzle } = book[i];
      pdf.addPage(fmt, 'portrait');
      placeCanvas(pdf, renderPuzzlePage(puzzle, CELL, `Puzzle ${i + 1}`));
      done++;
      onProgress(done, total);
      if (i % 4 === 0) await tick();
    }
    pdf.addPage(fmt, 'portrait');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(Math.min(36, pw * 0.08));
    pdf.text('ANSWER KEY', pw / 2, ph * 0.5, { align: 'center' });
    for (let i = 0; i < book.length; i++) {
      const { puzzle } = book[i];
      pdf.addPage(fmt, 'portrait');
      placeCanvas(
        pdf,
        renderPuzzlePage(puzzle, CELL, `Answer ${i + 1}`, { answerKey: true }),
      );
      done++;
      onProgress(done, total);
      if (i % 4 === 0) await tick();
    }
  }

  pdf.save(`${slugify(theme)}-wordsearch-book-${pageSize}.pdf`);
}

export async function exportBookZip(
  book: BookPuzzle[],
  theme: string,
  onProgress: (done: number, total: number) => void,
) {
  const zip = new JSZip();
  const puzzleDir = zip.folder('puzzles')!;
  const answerDir = zip.folder('answers')!;
  const pad = (n: number) => String(n).padStart(3, '0');
  const CELL = 28;

  for (let i = 0; i < book.length; i++) {
    const { puzzle } = book[i];
    const tag = `Puzzle ${i + 1}`;
    const q = renderPuzzlePage(puzzle, CELL, tag)
      .toDataURL('image/png')
      .split(',')[1];
    const a = renderPuzzlePage(puzzle, CELL, `Answer ${i + 1}`, { answerKey: true })
      .toDataURL('image/png')
      .split(',')[1];
    puzzleDir.file(`puzzle-${pad(i + 1)}.png`, q, { base64: true });
    answerDir.file(`answer-${pad(i + 1)}.png`, a, { base64: true });
    onProgress(i + 1, book.length);
    if (i % 3 === 0) await tick();
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
  });
  saveBlob(blob, `${slugify(theme)}-wordsearch-book.zip`);
}
