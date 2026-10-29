#!/usr/bin/env node
/*
 * Gera as imagens da página de apresentação (tools/paginas/img) a partir do app real,
 * usando a conta de exemplo. Rode depois de `python3 tools/build_pwa.py`:
 *
 *   node tools/capturas.js && python3 tools/build_pwa.py
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs"), OUT = path.join(ROOT, "tools", "paginas", "img");

const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]), f = path.join(DOCS, u.endsWith("/") ? u + "index.html" : u);
  if (!f.startsWith(DOCS) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" }[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0, "127.0.0.1", async () => {
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 });
  await p.goto(base);
  await p.evaluate(() => { SUPA.url = ""; renderLock(); }); // sem servidor: só para as imagens
  await p.click("#m-new");
  await p.fill("#nw-name", "Prof.ª Carla Mendes"); await p.fill("#nw-user", "carla.mendes"); await p.fill("#nw-pw", "senha-de-exemplo"); await p.fill("#nw-pw2", "senha-de-exemplo");
  await p.check("#nw-aceite"); await p.click("#new-f button[type=submit]");
  await p.waitForSelector("#rc-ok"); await p.check("#rc-ok"); await p.click("#rc-done");
  await p.waitForSelector("#bv-ex"); await p.click("#bv-ex");
  await p.waitForSelector("#view h1");
  await p.screenshot({ path: path.join(OUT, "tela-gabaritos.png") });
  await p.click(".tab[data-tab=corrigir]"); await p.click("#sc-demo");
  await p.waitForSelector("#rv-canvas:not([hidden])", { timeout: 30000 });
  await p.screenshot({ path: path.join(OUT, "tela-correcao.png") });
  await p.click("#rv-save"); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelector("#toast").hidden = true; });
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: path.join(OUT, "tela-resultados.png") });
  await p.evaluate(() => { const el = document.querySelector("#ch-pizza"); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 140); });
  await p.screenshot({ path: path.join(OUT, "tela-pizza.png") });
  const url = await p.evaluate(async () => {
    const fmts = ["colunas", "vertical", "horizontal", "blocos"], k = 5, cvs = [];
    for (const f of fmts) { const g = { code: 102, nQ: 20, nAlt: 5, layout: f }; const L = layoutDe(g); cvs.push([f, await svgToCanvas(blockSVG(g), L.W, L.H, k)]); }
    const pad = 40, W = cvs.reduce((a, [, c]) => a + c.width + pad, pad), H = Math.max(...cvs.map(([, c]) => c.height)) + 90;
    const o = document.createElement("canvas"); o.width = W; o.height = H;
    const x = o.getContext("2d"); x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, W, H);
    let px = pad; x.font = "bold 34px Arial"; x.fillStyle = "#141B2E";
    for (const [f, c] of cvs) { x.fillText(FORMATOS[f].nome, px, 50); x.strokeStyle = "#D3DAE6"; x.strokeRect(px - 1, 69, c.width + 2, c.height + 2); x.drawImage(c, px, 70); px += c.width + pad; }
    return o.toDataURL("image/png");
  });
  fs.writeFileSync(path.join(OUT, "cartao-formatos.png"), Buffer.from(url.split(",")[1], "base64"));
  await b.close(); srv.close();
  console.log("imagens geradas em tools/paginas/img");
});
