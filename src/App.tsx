import { useCallback, useEffect, useRef, useState } from 'react';
import { renderPuzzlePage } from './lib/render';
import {
  exportBookPdf,
  exportBookZip,
  generateBatch,
  type BookPuzzle,
  type PageSize,
} from './lib/book';

type Status = 'idle' | 'loading' | 'ready' | 'error';
interface Progress {
  label: string;
  done: number;
  total: number;
}

export default function App() {
  const [keyword, setKeyword] = useState('animals');
  const [count, setCount] = useState(50);
  const [wordsPerPuzzle, setWordsPerPuzzle] = useState(14);
  const [pageSize, setPageSize] = useState<PageSize>('6x9');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [book, setBook] = useState<BookPuzzle[]>([]);
  const [page, setPage] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  const seedRef = useRef(1);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const current = book[page] ?? null;
  const busy = progress !== null || status === 'loading';

  const generate = useCallback(() => {
    const theme = keyword.trim();
    if (!theme || busy) return;
    setStatus('loading');
    setError('');
    setWarnings([]);
    setBook([]);
    seedRef.current = Math.floor(Math.random() * 1e9);
    try {
      const { book: list, warnings: warns } = generateBatch(
        theme,
        seedRef.current,
        count,
        { wordsPerPuzzle },
      );
      setBook(list);
      setWarnings(Array.from(new Set(warns)).slice(0, 5));
      setPage(0);
      setShowAnswer(false);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, [keyword, busy, count, wordsPerPuzzle]);

  // Draw the current puzzle into the preview canvas.
  useEffect(() => {
    if (!current || !previewRef.current) return;
    const cv = previewRef.current;
    const src = renderPuzzlePage(
      current.puzzle,
      24,
      `${showAnswer ? 'Answer' : 'Puzzle'} ${page + 1}`,
      { answerKey: showAnswer },
    );
    cv.width = src.width;
    cv.height = src.height;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(src, 0, 0);
  }, [current, page, showAnswer]);

  const flip = (d: number) => {
    setPage((p) => Math.min(book.length - 1, Math.max(0, p + d)));
    setShowAnswer(false);
  };

  const download = (data: string, filename: string) => {
    const a = document.createElement('a');
    a.href = data;
    a.download = filename;
    a.click();
  };

  const runExport = async (kind: 'pdf' | 'zip') => {
    if (busy || !book.length) return;
    const label = kind === 'pdf' ? 'Building PDF book' : 'Zipping PNGs';
    setProgress({ label, done: 0, total: book.length * (kind === 'pdf' ? 2 : 1) });
    try {
      const cb = (d: number, t: number) => setProgress({ label, done: d, total: t });
      if (kind === 'pdf') await exportBookPdf(book, keyword, pageSize, cb);
      else await exportBookZip(book, keyword, cb);
    } finally {
      setProgress(null);
    }
  };

  const slug = keyword.trim().replace(/\s+/g, '-').toLowerCase() || 'wordsearch';
  const pct = progress
    ? Math.round((progress.done / Math.max(1, progress.total)) * 100)
    : 0;
  const placedCount = current?.puzzle.placed.length ?? 0;

  return (
    <div className="app">
      <header>
        <h1>Theme Word Search Book Generator</h1>
        <p className="sub">
          One keyword → a whole book of themed word-search puzzles. No sign-up.
        </p>
      </header>

      <div className="panel">
        <div className="row">
          <input
            value={keyword}
            placeholder="e.g. animals, sea, vehicles, dinosaurs"
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
          />
          <label className="num">
            Puzzles
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))
              }
            />
          </label>
          <label className="num">
            Words / puzzle
            <input
              type="number"
              min={4}
              max={20}
              value={wordsPerPuzzle}
              onChange={(e) =>
                setWordsPerPuzzle(
                  Math.max(4, Math.min(20, Number(e.target.value) || 14)),
                )
              }
            />
          </label>
          <button className="primary" onClick={generate} disabled={busy}>
            {busy ? 'Working…' : 'Generate book'}
          </button>
        </div>

        <div className="row">
          <label className="sel">
            Page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as PageSize)}
            >
              <option value="6x9">6 × 9 in</option>
              <option value="5x8">5 × 8 in</option>
              <option value="a4">A4</option>
            </select>
          </label>
        </div>

        <p className="note">
          General words expand per puzzle (e.g. <em>animals</em> → cat, dog,
          rat…). Each puzzle is an 18×18 grid with up to {wordsPerPuzzle} words
          placed horizontally, vertically, or diagonally.
        </p>

        {book.length > 0 && (
          <div className="row actions">
            <button onClick={generate} disabled={busy}>
              New shuffle
            </button>
            <button onClick={() => setShowAnswer((s) => !s)} disabled={busy}>
              {showAnswer ? 'Hide answer' : 'Show answer'}
            </button>
            <span className="spacer" />
            <button onClick={() => runExport('pdf')} disabled={busy}>
              Download PDF book
            </button>
            <button onClick={() => runExport('zip')} disabled={busy}>
              Download PNGs (.zip)
            </button>
            <button
              disabled={busy}
              onClick={() =>
                current &&
                download(
                  renderPuzzlePage(
                    current.puzzle,
                    28,
                    `${showAnswer ? 'Answer' : 'Puzzle'} ${page + 1}`,
                    { answerKey: showAnswer },
                  ).toDataURL('image/png'),
                  `${slug}-${showAnswer ? 'answer' : 'puzzle'}-${page + 1}.png`,
                )
              }
            >
              This page PNG
            </button>
          </div>
        )}
      </div>

      {progress && (
        <div className="progress">
          <div className="bar">
            <span style={{ width: `${pct}%` }} />
          </div>
          <small>
            {progress.label}: {progress.done} / {progress.total} ({pct}%)
          </small>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {warnings.length > 0 && (
        <div className="error" style={{ background: '#1d2540', borderColor: '#3b4d80', color: '#ffd58a' }}>
          {warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {status === 'loading' && !progress && (
        <div className="stage loadingbox">
          <div className="spinner" />
          <p>Building "{keyword.trim()}" puzzles…</p>
        </div>
      )}

      {current && (
        <>
          <div className="pager">
            <button onClick={() => flip(-1)} disabled={page === 0 || busy}>
              ‹ Prev
            </button>
            <span>
              Puzzle <strong>{page + 1}</strong> of {book.length}
            </span>
            <button
              onClick={() => flip(1)}
              disabled={page === book.length - 1 || busy}
            >
              Next ›
            </button>
          </div>
          <div className="stage">
            <div
              className="page-frame"
              style={{
                aspectRatio:
                  pageSize === '5x8'
                    ? '5 / 8'
                    : pageSize === '6x9'
                    ? '6 / 9'
                    : '210 / 297',
              }}
            >
              <h2 className="maze-title">
                {showAnswer ? 'Answer' : 'Puzzle'} {page + 1}
              </h2>
              <div className="maze-fit">
                <div className="canvas-wrap">
                  <canvas ref={previewRef} className="maze" />
                </div>
              </div>
            </div>
          </div>
          <div className="status">
            {placedCount} word{placedCount === 1 ? '' : 's'} placed
            <span className="src">
              {book.length} puzzle{book.length === 1 ? '' : 's'} · 18×18 grid
            </span>
          </div>
        </>
      )}

      {status === 'idle' && (
        <div className="stage hint">
          <p>Pick a theme word and a count, then "Generate book".</p>
        </div>
      )}
    </div>
  );
}
