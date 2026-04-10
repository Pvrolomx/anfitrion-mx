# QA Runner — Anfitrion MX

Script de QA automatizado. Corre 81 pruebas en ~26 segundos sin intervencion manual.

## Requisitos

- Node.js
- Browser Engine corriendo: `cd C:\Users\pvrol\browser-duendes && node server.js`

## Uso

```bash
node qa/qa-anfitrion.js
```

## Suites cubiertas

| Suite | Que prueba |
|---|---|
| 1 — HTTP | Carga, HTTP 200, contenido identico en ambos dominios |
| 2 — JS | Sintaxis (node --check), funciones criticas, try/catch en PDF |
| 3 — SEO | title, meta, OG tags, og:image accesible |
| 4 — PWA | manifest.json, sw.js, icons, privacy.html |
| 5 — Seguridad | API keys, HTTPS redirect, mixed content, XSS |
| 6 — Fiscal | COMISIONES, REGIMENES, estados, convenios ISH, labels |
| 7 — i18n | Textos ES/EN, disclaimer, updateLanguage() |
| 8 — Browser | Render real con Puppeteer (DOM, screenshot) |
| 9 — FX | /api/fx-usd, tipo de cambio en rango valido |

## Output

Genera `qa-report-YYYY-MM-DD.md` en la carpeta `qa/`.
Retorna exit code 1 si hay FAILs (util para CI/CD).

*La Colmena — 2026*
