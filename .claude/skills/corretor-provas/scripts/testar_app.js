#!/usr/bin/env node
/*
 * Testes de ponta a ponta do Corretor de Provas (Chromium headless via Playwright).
 *
 *   node .claude/skills/corretor-provas/scripts/testar_app.js [raiz-do-projeto]
 *
 * Verifica:
 *   1. leitura óptica em fotos sintéticas (prova "do Word" com o cartão colado),
 *      com tamanhos de cartão, rotação, perspectiva, desfoque, ruído, pouca luz e baixa resolução;
 *   2. marcação manual dos cantos (plano B);
 *   3. criação de conta, login errado/certo, isolamento entre contas e ausência de texto puro no armazenamento;
 *   4. persistência na "nuvem" (db simulado) depois de apagar o armazenamento do navegador;
 *   5. a versão instalável em docs/: service worker, abrir sem internet, PDF.
 * Sai com código 1 se algo falhar.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "../../../.."));
const SRC = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
// a página publicada recebe este esqueleto da plataforma; os testes reproduzem isso
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${SRC}</body></html>`;

function serve(dir, extra) {
  return new Promise((res) => {
    const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(req.url.split("?")[0]);
      if (extra && extra[u]) { rsp.writeHead(200, { "content-type": "text/html" }); return rsp.end(extra[u]); }
      let f = path.join(dir, u.endsWith("/") ? u + "index.html" : u);
      if (!f.startsWith(dir) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, "127.0.0.1", () => res(srv));
  });
}

const failures = [];
const check = (ok, msg) => { console.log(`${ok ? "OK  " : "FALHOU"}  ${msg}`); if (!ok) failures.push(msg); };

(async () => {
  const srv = await serve(path.join(ROOT, "docs"), { "/__teste.html": PAGE });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const store = new Map();
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, acceptDownloads: true });
  // db + user simulados (mesmo formato da capacidade do artifact)
  await ctx.exposeBinding("__db", (_, op, p, data) => {
    if (op === "get") return store.has(p) ? JSON.parse(store.get(p)) : null;
    if (op === "set") { store.set(p, JSON.stringify(data)); return true; }
    if (op === "del") { store.delete(p); return true; }
    if (op === "q") { const out = []; for (const [k, v] of store) if (k.startsWith(p + "/") && k.split("/").length === p.split("/").length + 1) { const d = JSON.parse(v); if (d[data.f] === data.v) out.push({ id: k.split("/").pop(), d }); } return out; }
  });
  const fakeClaude = () => {
    if (!location.pathname.includes("__teste")) return;
    const mkDoc = (p) => ({ get: async () => { const d = await window.__db("get", p); return { exists: !!d, data: () => d }; }, set: (d) => window.__db("set", p, d), delete: () => window.__db("del", p) });
    const db = { doc: mkDoc, collection: (p) => ({ where: (f, op, v) => ({ get: async () => ({ docs: (await window.__db("q", p, { f, v })).map((x) => ({ id: x.id, data: () => x.d })) }) }) }) };
    window.claude = { use: async (n) => (n === "db" ? db : n === "user" ? { id: async () => "u_teste" } : n === "downloads" ? { save: async () => ({ status: "saved" }) } : null) };
  };
  await ctx.addInitScript(fakeClaude);

  const errs = [];
  const watch = (p) => { p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && !/ERR_|fonts|Failed to load resource/.test(m.text()) && errs.push(m.text())); };
  const p = await ctx.newPage(); watch(p);
  await p.goto(base + "/__teste.html");
  await p.click("#m-new");
  await p.fill("#nw-name", "Prof. Teste"); await p.fill("#nw-user", "teste"); await p.fill("#nw-pw", "senha1234"); await p.fill("#nw-pw2", "senha1234");
  await p.click("#new-f button[type=submit]"); await p.waitForSelector("#view h1");

  // ---- 1 e 2: leitura óptica ----
  const omr = await p.evaluate(async () => {
    const out = [];
    const warp = (src, corners, W, H) => {
      const sw = src.width, sh = src.height, Hm = homography(corners, [[0, 0], [sw, 0], [sw, sh], [0, sh]]);
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const sd = src.getContext("2d").getImageData(0, 0, sw, sh).data, x = c.getContext("2d"), o = x.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
        const [u, v] = applyH(Hm, X, y), k = (y * W + X) * 4, px = Math.round(u), py = Math.round(v);
        if (px < 0 || py < 0 || px >= sw || py >= sh) { o.data[k] = 110; o.data[k + 1] = 90; o.data[k + 2] = 70; }
        else { const j = (py * sw + px) * 4; o.data[k] = sd[j]; o.data[k + 1] = sd[j + 1]; o.data[k + 2] = sd[j + 2]; }
        o.data[k + 3] = 255;
      }
      x.putImageData(o, 0, 0); return c;
    };
    const rot = (c, t) => { const r = document.createElement("canvas"), odd = t % 2; r.width = odd ? c.height : c.width; r.height = odd ? c.width : c.height; const x = r.getContext("2d"); x.translate(r.width / 2, r.height / 2); x.rotate((t * Math.PI) / 2); x.drawImage(c, -c.width / 2, -c.height / 2); return r; };
    const degrade = (src, { blur = 0, noise = 0, contrast = 1, bright = 0, scaleTo = 0 }) => {
      let c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
      const x = c.getContext("2d"); x.filter = `blur(${blur}px) contrast(${contrast}) brightness(${1 + bright})`; x.drawImage(src, 0, 0); x.filter = "none";
      if (noise) { const d = x.getImageData(0, 0, c.width, c.height); for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * noise; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } x.putImageData(d, 0, 0); }
      if (scaleTo) { const c2 = document.createElement("canvas"); c2.width = scaleTo; c2.height = Math.round((src.height * scaleTo) / src.width); c2.getContext("2d").drawImage(c, 0, 0, c2.width, c2.height); c = c2; }
      return c;
    };
    const run = (name, canvas, truth, gid) => {
      const r = scanPhoto(canvas, "auto");
      if (!r.ok) return out.push({ name, ok: false, why: r.reason });
      const wrong = r.answers.filter((a, i) => a !== truth[i]).length;
      out.push({ name, ok: wrong === 0 && r.gab.id === gid, why: wrong ? `${wrong} respostas erradas` : r.gab.id !== gid ? "gabarito errado" : "" });
    };
    const mkG = (nQ, nAlt, code) => { const g = { id: "t" + code, code, name: "T" + nQ, nQ, nAlt, points: 10, key: Array.from({ length: nQ }, (_, i) => (i * 7) % nAlt) }; S.data.gabaritos.push(g); return g; };
    const g20 = S.data.gabaritos[0];
    for (const [g, sc] of [[g20, 0.8], [g20, 0.5], [mkG(50, 4, 333), 0.75], [mkG(100, 5, 77), 0.9], [mkG(8, 5, 5), 0.7]]) {
      const s = await samplePhoto(g, 11, sc);
      run(`${g.nQ} questões, cartão a ${sc * 100}%`, s.canvas, s.truth, g.id);
      if (g === g20 && sc === 0.8) {
        run("foto de lado (90°)", rot(s.canvas, 1), s.truth, g.id);
        run("foto de ponta-cabeça", rot(s.canvas, 2), s.truth, g.id);
        run("perspectiva", warp(s.canvas, [[120, 60], [1330, 180], [1450, 1900], [30, 1990]], 1500, 2000), s.truth, g.id);
        run("desfoque 2px", degrade(s.canvas, { blur: 2 }), s.truth, g.id);
        run("ruído forte", degrade(s.canvas, { noise: 60, blur: 1 }), s.truth, g.id);
        run("escura e sem contraste", degrade(s.canvas, { contrast: 0.45, bright: -0.35, noise: 20 }), s.truth, g.id);
        run("baixa resolução (900px)", degrade(s.canvas, { scaleTo: 900 }), s.truth, g.id);
        const loc = locateBlock(s.canvas);
        const taps = loc.dst.map(([x, y], i) => refinePoint(s.canvas, x + (i % 2 ? 22 : -18), y + (i < 2 ? -15 : 19)));
        const r = scanCorners(s.canvas, [taps[2], taps[0], taps[3], taps[1]], "auto");
        out.push({ name: "marcação manual dos cantos (toques imprecisos)", ok: r.ok && r.answers.every((a, i) => a === s.truth[i]), why: r.ok ? "" : r.reason });
      }
    }
    // formatos de cartão (Uma coluna, Horizontal, Blocos de 5): tamanhos variados e fotos ruins
    let cod = 450;
    for (const [modo, tamanhos] of [["vertical", [8, 20, 35]], ["horizontal", [7, 20, 50, 100]], ["blocos", [8, 20, 50, 100]]]) for (const nQ of tamanhos) for (const nAlt of [4, 5]) {
      const g = mkG(nQ, nAlt, cod++); g.layout = modo;
      const L = layoutDe(g);
      if (L.W > 190 || L.H > 275) { out.push({ name: `formato ${modo} ${nQ}q: cabe numa folha A4`, ok: false, why: `${Math.round(L.W)}×${Math.round(L.H)} mm` }); continue; }
      const s = await samplePhoto(g, 5 + nQ, 0.8);
      run(`formato ${modo}, ${nQ} questões ${LET[0]}–${LET[nAlt - 1]}`, nQ % 2 ? degrade(s.canvas, { blur: 1.5, noise: 30 }) : s.canvas, s.truth, g.id);
    }
    S.data.gabaritos = S.data.gabaritos.filter((g) => !String(g.id).startsWith("t"));
    const blank = document.createElement("canvas"); blank.width = 1000; blank.height = 1300;
    const bc = blank.getContext("2d"); bc.fillStyle = "#fff"; bc.fillRect(0, 0, 1000, 1300); bc.fillStyle = "#000"; bc.font = "40px Arial";
    for (let i = 0; i < 20; i++) bc.fillText("■ Texto qualquer ● O ◎ @", 40, 60 + i * 60);
    const nb = scanPhoto(blank, "auto");
    out.push({ name: "página sem cartão é recusada", ok: !nb.ok && nb.reason === "markers", why: nb.ok ? "leu um cartão que não existe" : nb.reason === "markers" ? "" : nb.reason });
    return out;
  });
  for (const r of omr) check(r.ok, `leitura: ${r.name}${r.why ? ` (${r.why})` : ""}`);

  // ---- 3 e 4: contas, criptografia e persistência ----
  await p.click(".tab[data-tab=corrigir]"); await p.click("#sc-demo");
  await p.waitForSelector("#rv-canvas:not([hidden])", { timeout: 20000 });
  await p.click("#rv-save"); await p.waitForTimeout(800);
  const nRes = await p.evaluate(() => S.data.results.length);
  check(!(await p.evaluate(() => JSON.stringify(localStorage).includes("Marina") || JSON.stringify(localStorage).includes("Ciências"))), "nada legível no armazenamento do navegador");
  check([...store.keys()].some((k) => k.includes("/conta-")) && [...store.keys()].some((k) => k.includes("/img-")), "conta e imagem do cartão salvas na nuvem");
  await p.click("#btn-lock");
  await p.fill("#lg-pw", "errada"); await p.click("#login-f button[type=submit]"); await p.waitForSelector(".err");
  check(true, "senha errada é recusada");
  await p.evaluate(async () => { localStorage.clear(); await new Promise((r) => { const q = indexedDB.deleteDatabase("corretor-provas"); q.onsuccess = q.onerror = q.onblocked = r; }); });
  const p2 = await ctx.newPage(); watch(p2); await p.close();
  await p2.goto(base + "/__teste.html");
  await p2.fill("#lg-user", "teste"); await p2.fill("#lg-pw", "senha1234"); await p2.click("#login-f button[type=submit]");
  await p2.waitForSelector("#view h1");
  check((await p2.evaluate(() => S.data.results.length)) === nRes, "login funciona depois de apagar o navegador (dados vêm da nuvem)");
  await p2.click(".tab[data-tab=resultados]");
  await p2.click("tr.click >> nth=0").catch(() => {});
  await p2.click("#btn-lock").catch(() => {});
  await p2.click("#m-new"); await p2.fill("#nw-name", "Outro"); await p2.fill("#nw-user", "outro"); await p2.fill("#nw-pw", "outrasenha"); await p2.fill("#nw-pw2", "outrasenha");
  await p2.click("#new-f button[type=submit]"); await p2.waitForSelector("#view h1");
  check((await p2.evaluate(() => S.data.results.length)) === nRes - 1, "contas separadas (a nova só tem os exemplos)");
  await p2.close();

  // ---- 5: versão instalável ----
  if (fs.existsSync(path.join(ROOT, "docs", "index.html"))) {
    const ctx2 = await browser.newContext({ viewport: { width: 400, height: 860 }, acceptDownloads: true });
    const q = await ctx2.newPage(); watch(q);
    await q.goto(base + "/");
    await q.evaluate(() => navigator.serviceWorker.ready);
    await q.reload(); await q.waitForTimeout(400);
    await ctx2.setOffline(true);
    await q.reload(); await q.waitForSelector("#m-new", { timeout: 10000 });
    check(await q.evaluate(() => !!window.jspdf), "app instalável abre sem internet (com gerador de PDF)");
    await q.click("#m-new"); await q.fill("#nw-name", "P"); await q.fill("#nw-user", "pwa"); await q.fill("#nw-pw", "senha1234"); await q.fill("#nw-pw2", "senha1234");
    await q.click("#new-f button[type=submit]"); await q.waitForSelector("#view h1");
    await q.click("[data-act=sheet]");
    const [dl] = await Promise.all([q.waitForEvent("download", { timeout: 20000 }), q.click("#sh-pdf")]);
    check(dl.suggestedFilename().endsWith(".pdf"), "PDF do cartão é gerado");
    await ctx2.close();
  } else check(false, "docs/ não existe: rode python3 tools/build_pwa.py");

  check(errs.length === 0, `sem erros de JavaScript${errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""}`);
  await browser.close(); srv.close();
  console.log(failures.length ? `\n${failures.length} falha(s).` : "\nTudo certo.");
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
