#!/usr/bin/env node
/*
 * Testa a sincronização entre aparelhos com um servidor que imita o Supabase
 * (Auth + REST nas tabelas cofres e imagens, com a regra "cada um só vê o seu").
 *
 *   python3 tools/build_pwa.py
 *   node .claude/skills/corretor-provas/scripts/testar_sincronizacao.js [raiz-do-projeto]
 *
 * Dois "aparelhos" (contextos do navegador) usam a mesma conta: criar conta, corrigir prova,
 * ver no outro aparelho (com imagem), edição sem internet + mesclagem, exclusão que não volta,
 * troca de senha, senha errada, conta antiga só do aparelho e o servidor nunca vendo texto puro.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "../../../.."));
const DOCS = path.join(ROOT, "docs");

/* ---------- servidor que imita o Supabase ---------- */
const users = new Map(), tokens = new Map(), tables = { cofres: [], imagens: [] };
let tablesReady = true; // false = o professor ainda não rodou o configurar.sql
const keyOf = { cofres: (r) => r.user_id, imagens: (r) => r.user_id + "|" + r.id };
function supaMock(req, res) {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS" };
  const send = (code, body) => { res.writeHead(code, { ...cors, "content-type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (req.headers.apikey !== "chave-publica-teste") return send(401, { message: "Invalid API key" });
  let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
    const body = raw ? JSON.parse(raw) : null, u = new URL(req.url, "http://x");
    const uid = tokens.get((req.headers.authorization || "").replace("Bearer ", ""));
    const session = (id) => { const t = crypto.randomBytes(16).toString("hex"); tokens.set(t, id); return { access_token: t, expires_in: 3600, user: { id } }; };
    if (u.pathname === "/auth/v1/signup") {
      if (users.has(body.email)) return send(422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
      const id = crypto.randomUUID(); users.set(body.email, { id, password: body.password }); return send(200, session(id));
    }
    if (u.pathname === "/auth/v1/token") {
      const x = users.get(body.email);
      if (!x || x.password !== body.password) return send(400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return send(200, session(x.id));
    }
    if (u.pathname === "/auth/v1/user" && req.method === "PUT") {
      if (!uid) return send(401, { msg: "not logged in" });
      for (const x of users.values()) if (x.id === uid) x.password = body.password;
      return send(200, { id: uid });
    }
    const m = u.pathname.match(/^\/rest\/v1\/(cofres|imagens)$/);
    if (!m) return send(404, { message: "not found" });
    if (!uid) return send(401, { message: "JWT required" });
    if (!tablesReady) return send(404, { code: "PGRST205", message: `Could not find the table 'public.${m[1]}' in the schema cache` });
    const tbl = m[1], filters = [...u.searchParams].filter(([k]) => k !== "select").map(([k, v]) => [k, v.replace(/^eq\./, "")]);
    const mine = (r) => r.user_id === uid && filters.every(([k, v]) => String(r[k]) === v); // regra de acesso por linha
    if (req.method === "GET") return send(200, tables[tbl].filter(mine));
    if (req.method === "DELETE") { tables[tbl] = tables[tbl].filter((r) => !mine(r)); return send(204); }
    if (req.method === "POST") {
      if (body.user_id !== uid) return send(403, { message: "row-level security" });
      const k = keyOf[tbl](body), i = tables[tbl].findIndex((r) => keyOf[tbl](r) === k);
      if (i >= 0) tables[tbl][i] = body; else tables[tbl].push(body);
      return send(201);
    }
    send(405, {});
  });
}
function staticServer(dir) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png" };
  return http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]), f = path.join(dir, u.endsWith("/") ? u + "index.html" : u);
    if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  });
}
const listen = (srv) => new Promise((r) => srv.listen(0, "127.0.0.1", () => r(srv.address().port)));

const failures = [];
const check = (ok, msg) => { console.log(`${ok ? "OK  " : "FALHOU"}  ${msg}`); if (!ok) failures.push(msg); };

(async () => {
  const api = `http://127.0.0.1:${await listen(http.createServer(supaMock))}`;
  const site = `http://127.0.0.1:${await listen(staticServer(DOCS))}/`;
  const browser = await chromium.launch();
  const errs = [];
  async function device(name) {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(`${name}: ${e.message}`));
    await p.goto(site);
    await p.evaluate((u) => { SUPA.url = u; SUPA.key = "chave-publica-teste"; renderLock(); }, api);
    return { ctx, p };
  }
  const login = async (p, user, pw) => {
    if (await p.isVisible("#m-login")) await p.click("#m-login");
    await p.fill("#lg-user", user); await p.fill("#lg-pw", pw); await p.click("#login-f button[type=submit]");
    await p.waitForFunction(() => !document.querySelector("#busy") || document.querySelector("#busy").hidden, null, { timeout: 30000 });
  };
  const state = (p) => p.evaluate(() => S.data ? { g: S.data.gabaritos.map((x) => x.name), r: S.data.results.length, on: sync.on } : null);
  const syncNowP = (p) => p.evaluate(async () => { await syncNow(); return sync.err; });

  // 1. celular cria conta
  const A = await device("celular");
  await A.p.click("#m-new");
  await A.p.fill("#nw-name", "Prof.ª Ana"); await A.p.fill("#nw-user", "ana.prof"); await A.p.fill("#nw-pw", "senha1234"); await A.p.fill("#nw-pw2", "senha1234");
  await A.p.click("#new-f button[type=submit]"); await A.p.waitForSelector("#view h1", { timeout: 30000 });
  check((await state(A.p)).on && tables.cofres.length === 1, "conta criada já sincronizando (cofre no servidor)");

  // 2. celular corrige uma prova
  await A.p.click(".tab[data-tab=corrigir]"); await A.p.click("#sc-demo");
  await A.p.waitForSelector("#rv-canvas:not([hidden])", { timeout: 30000 });
  await A.p.fill("#rv-name", "Marina Alves Pereira"); await A.p.click("#rv-save"); await A.p.waitForTimeout(500);
  await syncNowP(A.p);
  check(tables.imagens.length === 1, "imagem do cartão enviada ao servidor");
  const all = JSON.stringify(tables);
  check(!/Marina|Ciências|Exemplo/.test(all), "servidor não guarda nada legível (nomes, gabaritos)");
  check([...users.values()].every((x) => x.password !== "senha1234"), "servidor nunca recebe a senha real");

  // 3. computador entra com a mesma conta
  const B = await device("computador");
  await login(B.p, "ana.prof", "senha1234"); await B.p.waitForSelector("#view h1");
  const sa = await state(A.p), sb = await state(B.p);
  check(sb && sb.r === sa.r && sb.g.join() === sa.g.join(), `computador vê os mesmos dados (${sb && sb.r} provas)`);
  const imgOk = await B.p.evaluate(async () => { const r = S.data.results.find((x) => x.student === "Marina Alves Pereira"); return !!(r && (await loadImage(r.id))); });
  check(imgOk, "computador abre a imagem do cartão corrigido no celular");

  // 4. novo gabarito no computador aparece no celular
  await B.p.evaluate(async () => { S.data.gabaritos.unshift(stamp({ id: "gpc", code: 400, name: "Prova feita no PC", nQ: 10, nAlt: 4, points: 10, key: Array(10).fill(0), created: Date.now() })); await persist(); await syncChain; });
  await syncNowP(A.p);
  check((await state(A.p)).g.includes("Prova feita no PC"), "gabarito criado no computador aparece no celular");

  // 5. celular sem internet + computador mexendo ao mesmo tempo: nada se perde
  await A.ctx.setOffline(true);
  await A.p.evaluate(async () => { S.data.gabaritos.unshift(stamp({ id: "goff", code: 401, name: "Feita sem internet", nQ: 5, nAlt: 4, points: 10, key: Array(5).fill(1), created: Date.now() })); await persist(); await syncChain; });
  await B.p.evaluate(async () => { S.data.gabaritos.unshift(stamp({ id: "gpc2", code: 402, name: "Outra do PC", nQ: 5, nAlt: 4, points: 10, key: Array(5).fill(2), created: Date.now() })); await persist(); await syncChain; });
  await A.ctx.setOffline(false);
  await syncNowP(A.p); await syncNowP(B.p);
  const a5 = await state(A.p), b5 = await state(B.p);
  check(["Feita sem internet", "Outra do PC"].every((n) => a5.g.includes(n) && b5.g.includes(n)), "edições sem internet se juntam com as do outro aparelho");

  // 6. exclusão não "ressuscita"
  await B.p.evaluate(async () => { tomb("goff"); S.data.gabaritos = S.data.gabaritos.filter((g) => g.id !== "goff"); await persist(); await syncChain; });
  await syncNowP(A.p); await syncNowP(B.p);
  check(!(await state(A.p)).g.includes("Feita sem internet") && !(await state(B.p)).g.includes("Feita sem internet"), "gabarito apagado num aparelho some do outro e não volta");

  // 7. troca de senha no celular
  await A.p.click(".tab[data-tab=conta]");
  await A.p.fill("#sx-old", "senha1234"); await A.p.fill("#sx-new", "novasenha99"); await A.p.fill("#sx-new2", "novasenha99");
  await A.p.click("#sx-pw button[type=submit]");
  await A.p.waitForFunction(() => document.querySelector("#toast").textContent.includes("Senha trocada"), null, { timeout: 60000 });
  await syncNowP(B.p);
  const bLocked = await B.p.evaluate(() => !S.key && document.querySelector("#lock").innerText.includes("trocada em outro aparelho"));
  check(bLocked, "computador sai sozinho e avisa quando a senha é trocada no celular");
  await login(B.p, "ana.prof", "senha1234");
  check(await B.p.isVisible(".err"), "senha antiga não entra mais");
  await login(B.p, "ana.prof", "novasenha99"); await B.p.waitForSelector("#view h1");
  check((await state(B.p)).r === (await state(A.p)).r, "senha nova entra no computador com tudo lá");
  const imgOk2 = await B.p.evaluate(async () => { const r = S.data.results.find((x) => x.student === "Marina Alves Pereira"); return !!(r && (await loadImage(r.id))); });
  check(imgOk2, "imagens continuam abrindo depois da troca de senha");

  // 8. usuário que não existe
  const C = await device("outro");
  await login(C.p, "ninguem", "qualquer123");
  check((await C.p.innerText(".err")).includes("incorretos"), "usuário inexistente recebe aviso claro");

  // 9. conta antiga, criada sem sincronização, sobe para o servidor ao entrar
  await C.p.evaluate(async () => { SUPA.url = ""; });
  await C.p.click("#m-new"); await C.p.fill("#nw-name", "Velha"); await C.p.fill("#nw-user", "conta.velha"); await C.p.fill("#nw-pw", "senha5678"); await C.p.fill("#nw-pw2", "senha5678");
  await C.p.click("#new-f button[type=submit]"); await C.p.waitForSelector("#view h1");
  await C.p.click("#btn-lock");
  await C.p.evaluate((u) => { SUPA.url = u; }, api);
  const before = tables.cofres.length;
  await login(C.p, "conta.velha", "senha5678"); await C.p.waitForSelector("#view h1");
  check(tables.cofres.length === before + 1 && (await state(C.p)).on, "conta que só existia no aparelho passa a sincronizar");

  // 10. servidor sem as tabelas (configurar.sql não rodado): a conta é criada no aparelho e sincroniza depois
  tablesReady = false;
  const D = await device("pc-do-flavio");
  await D.p.click("#m-new"); await D.p.fill("#nw-name", "Flávio"); await D.p.fill("#nw-user", "flavio.moura"); await D.p.fill("#nw-pw", "senha9876"); await D.p.fill("#nw-pw2", "senha9876");
  await D.p.click("#new-f button[type=submit]"); await D.p.waitForSelector("#view h1", { timeout: 30000 });
  await D.p.click(".tab[data-tab=conta]");
  check((await D.p.innerText("#sync-note")).includes("configurar.sql"), "sem as tabelas: entra no app e a aba Conta explica que falta rodar o configurar.sql");
  // segunda tentativa de criar a mesma conta (já existe pela metade no servidor) também não trava
  const E = await device("celular-do-flavio");
  await E.p.click("#m-new"); await E.p.fill("#nw-name", "Flávio"); await E.p.fill("#nw-user", "flavio.moura"); await E.p.fill("#nw-pw", "senha9876"); await E.p.fill("#nw-pw2", "senha9876");
  await E.p.click("#new-f button[type=submit]"); await E.p.waitForSelector("#view h1", { timeout: 30000 });
  check(true, "criar de novo a conta que ficou pela metade não dá erro");
  tablesReady = true;
  const before10 = tables.cofres.length;
  await D.p.click("#sx-sync"); await D.p.waitForFunction(() => sync.on, null, { timeout: 30000 });
  check(tables.cofres.length === before10 + 1, "depois de criar as tabelas, o aparelho sincroniza sozinho");
  await syncNowP(E.p);
  check((await E.p.evaluate(() => sync.err)).includes("entre de novo"), "o outro aparelho (conta criada separada) pede para entrar de novo");
  const ePronto = await E.p.evaluate(() => S.data.results.length);
  await E.p.click("#btn-lock"); await login(E.p, "flavio.moura", "senha9876"); await E.p.waitForSelector("#view h1");
  await syncNowP(D.p);
  check((await E.p.evaluate(() => sync.on)) && (await D.p.evaluate(() => S.data.results.length)) === (await E.p.evaluate(() => S.data.results.length)), "ao entrar de novo, os dados dos dois aparelhos se juntam");

  check(errs.length === 0, `sem erros de JavaScript${errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""}`);
  await browser.close();
  console.log(failures.length ? `\n${failures.length} falha(s).` : "\nTudo certo.");
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
