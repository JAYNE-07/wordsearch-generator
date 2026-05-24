# Theme Word Search Generator

Generate printable word-search puzzle books in any theme — type a keyword
(`animals`, `food`, `vehicles`, `space`…), get a book of 1–500 puzzles where
every page is a different on-theme word list.

Themes share the same 165-keyword dictionary as the [maze book generator](https://jayne-07.github.io/maze-generator/).
In-browser PDF/PNG/ZIP export. Pages sized for 5×8″, 6×9″, or A4 trim.
Answer-key pages at the back of the book.

**Live site:** https://jayne-07.github.io/wordsearch-generator/

## Run locally

```sh
npm install
npm run dev      # http://localhost:5173/
npm run build    # production bundle in dist/
npm run preview  # preview the production build
```

## Defaults

- 18×18 letter grid (configurable in the UI)
- Up to 14 words per puzzle (configurable, min 4)
- Directions: horizontal, vertical, diagonal-down-right, diagonal-up-right
