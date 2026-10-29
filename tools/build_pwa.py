"""Gera o app instalável (PWA) em docs/ a partir de index.html (publicado pelo GitHub Pages).

Uso: python3 tools/build_pwa.py
"""
import hashlib, json, pathlib, re, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs"
src = (ROOT / "index.html").read_text(encoding="utf-8")

# jsPDF local (funciona offline)
src = src.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>',
                  '<script src="vendor/jspdf.umd.min.js"></script>')
assert "vendor/jspdf" in src

register = """<script>
if ("serviceWorker" in navigator && location.protocol !== "file:" && !window.AndroidBridge) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
</script>"""

head = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#2340C4">
<meta name="description" content="Corrija provas de múltipla escolha fotografando o cartão-resposta.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Corretor">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}</style>
"""
# <title>, <meta> e <link>/<style> do topo do arquivo vão para o <head>
body_start = src.index("<div id=\"lock\"")
top, rest = src[:body_start], src[body_start:]
html = head + top + "</head>\n<body>\n" + rest + "\n" + register + "\n</body>\n</html>\n"

if OUT.exists():
    for p in OUT.iterdir():
        if p.name != "icons":
            shutil.rmtree(p) if p.is_dir() else p.unlink()
OUT.mkdir(exist_ok=True)
(OUT / "vendor").mkdir(exist_ok=True)
(OUT / "index.html").write_text(html, encoding="utf-8")
shutil.copy(ROOT / "tools" / "vendor" / "jspdf.umd.min.js", OUT / "vendor" / "jspdf.umd.min.js")

manifest = {
    "name": "Corretor de Provas",
    "short_name": "Corretor",
    "description": "Corrija provas de múltipla escolha fotografando o cartão-resposta.",
    "lang": "pt-BR",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#EEF1F6",
    "theme_color": "#2340C4",
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}
(OUT / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

shell = ["./", "index.html", "manifest.webmanifest", "vendor/jspdf.umd.min.js",
         "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"]
version = hashlib.sha256(html.encode()).hexdigest()[:10]
sw = (ROOT / "tools" / "sw.template.js").read_text(encoding="utf-8")
sw = sw.replace("__VERSION__", version).replace("__SHELL__", json.dumps(shell))
(OUT / "sw.js").write_text(sw, encoding="utf-8")
# páginas públicas: apresentação, privacidade e termos
PAG = ROOT / "tools" / "paginas"
(OUT / "paginas" / "img").mkdir(parents=True, exist_ok=True)
shutil.copy(PAG / "estilo.css", OUT / "paginas" / "estilo.css")
for img in (PAG / "img").glob("*.png"):
    shutil.copy(img, OUT / "paginas" / "img" / img.name)
for nome in ("apresentacao", "privacidade", "termos"):
    (OUT / nome).mkdir(exist_ok=True)
    shutil.copy(PAG / f"{nome}.html", OUT / nome / "index.html")
print(f"docs/ gerado (versão {version})")
