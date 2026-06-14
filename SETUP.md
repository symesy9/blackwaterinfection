# BlackWater Infection — GitHub Pages deploy

Live site: **https://symesy9.github.io/blackwaterinfection/**

## Why you see 404 on JS/CSS

The build must use the same path GitHub Pages serves the site from. This repo uses:

```
/blackwaterinfection/
```

If `index.html` still points at `/ratzilla2/assets/...`, the browser will 404.

## Deploy steps (every time you update)

```bash
cd ratzilla2
npm run publish
```

Then **commit and push** these files to the **root** of the `blackwaterinfection` GitHub repo:

- `index.html`
- `404.html`
- `assets/` (whole folder — includes hashed `.js` / `.css` **and** images/video)

Do **not** push `src/` or `index.vite.html` (dev only).

## Different host/path

Override the base path when building:

```bash
VITE_BASE_PATH=/ratzilla2/ npm run publish
```

## Dev vs production

| File | Purpose |
|------|---------|
| `index.vite.html` | Local dev only (`npm run dev`) |
| `index.html` | Production — created by `npm run publish` |
| `src/` | Source code — not needed on GitHub Pages |

## SPA routes

`404.html` is a copy of `index.html` so `/blackwaterinfection/infection` works after refresh when GitHub Pages is configured to use it.
