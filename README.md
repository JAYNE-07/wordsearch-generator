# Theme Word Search Generator

React + Vite + TypeScript app that turns a single theme keyword into a printable
PDF book of word-search puzzles. Forked from
[`maze-generator`](https://github.com/JAYNE-07/maze-generator).

- 18×18 letter grid (configurable)
- Up to 14 words per puzzle (configurable)
- Directions: horizontal, vertical, diagonal-down-right, diagonal-up-right
- Themes drawn from the same 165-keyword dictionary as the maze generator
- Exports: PDF book (5×8, 6×9, A4) + ZIP of PNGs
- Answer key pages at the back of the book

## Develop

```bash
npm install
npm run dev
```

## Build / deploy

```bash
npm run build
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
