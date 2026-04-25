# AD2D (Automatic Data to Document)

Generate thousands of PDFs (certificates, letters, tickets, etc) from a spreadsheet and an SVG template directly in your browser. Spiritual successor to [AnyMailMerge](https://github.com/vicfic18/AnyMailMerge).

No server uploads, this works completely in client side.

## Why?
I was tired of seeing "free certificate generators" that upload your sensitive data to some random backend, take 10 minutes to process, and hit you with a paywall for batch printing. 

AD2D runs locally on your machine. The server is just there to serve static React files. Your data never leaves your browser.

## Installation (Local Dev)

Standard Next.js 14 stack.

```bash
git clone <repo-url>
cd ad2d
npm install
npm run dev
```

Open `localhost:3000`.

## Deployment (Production)

```bash
docker-compose up -d --build
```
This runs the containerized app on port 3000. Just reverse proxy it with Nginx/Caddy to your domain. 

## Notes & Constraints
- Custom SVG fonts are a tough to embed for standard PDF renderers. AD2D overwrites whatever custom fonts you have in your SVG to standard `Helvetica`. It might slightly change your layout, but it guarantees the PDFs will actually render. 
- Try to keep your SVGs clean. Export them properly from Inkscape/Illustrator/Figma.

## TODOs
- [ ] Add support for dragging in custom `.ttf` fonts
- [ ] Support dynamic image injection (e.g. throwing different profile pics into each PDF).
- [ ] Throw mapping configurations into `localStorage` so you don't have to re-map columns after a page refresh.
- [ ] True Web Worker parallelization (currently chunking the main thread because `svg2pdf` needs DOM access, waiting for a good OffscreenCanvas/DOM-less polyfill).
