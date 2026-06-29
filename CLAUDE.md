# CLAUDE.md — anfitrion-mx

Guía para trabajar este repo con Claude Code. Léela (y la memoria del proyecto)
antes de hacer cualquier pre-análisis. Si algo aquí contradice la tarea, dilo
antes de tocar archivos.

## Qué es

Calculadora fiscal para anfitriones de Airbnb/Vrbo/Booking en México (ISR, IVA,
ISH, comisiones). **Toda la app vive en un solo archivo:** `public/index.html`
(HTML + CSS + JS inline, sin build step). Producción:
`https://anfitrion.expatadvisormx.com` (también `anfitrion-mx.vercel.app`).

## Pipeline de deploy y QA

- **Deploy:** push a `main` → **Vercel auto-despliega**. No hay build; se sirve
  el estático tal cual.
- **Verificación:** `cd C:\Users\pvrol\qa-runner && node qa-anfitrion.js`.
  Son **103 pruebas; la meta es 103/103 PASS**.
- ⚠️ **El QA descarga el HTML de PRODUCCIÓN, no del working copy.** Por eso, para
  validar un cambio hay que **commitear + pushear + esperar el deploy** primero.
- La **Suite 8 (Browser Engine)** necesita un servicio Puppeteer en `localhost:3847`:
  `cd C:\Users\pvrol\browser-duendes && node server.js` (requiere Chrome).
  Sin él solo corren ~97 pruebas. Levantarlo al inicio, detenerlo al final.
- **Definición de "terminado":** 103/103 PASS + pusheado + deploy verificado en vivo.

## Tripwires conocidos (si tocas X, también actualiza Y)

- **`generatePDF()` → GOLDEN_HASH + GOLDEN_MARKERS.** Cualquier cambio a esa función
  invalida el snapshot del PDF. El hash se saca con
  `node qa-anfitrion.js --update-pdf-snapshot` **contra producción ya desplegada**,
  nunca calculándolo del archivo local. Si un literal vigilado por un marker se mueve
  a `TEXTS` (p.ej. una etiqueta de fila), hay que cambiar ese marker a su nueva
  referencia `t.*`. Suele implicar 2 commits: código primero, hash después.
- **CRLF vs LF.** El archivo local es **CRLF**; Vercel sirve **LF**. El GOLDEN_HASH
  es exacto sobre el texto fuente, así que un hash calculado localmente NO coincide
  con producción. Siempre tomar el hash de prod vía `--update-pdf-snapshot`.
- **Tasa ISH → 3 lugares + QA.** Cambiar la tasa de un estado exige actualizar:
  (1) `ESTADOS.ish` (objeto JS), (2) `data-rate` del `<option>`, (3) el texto visible
  del `<option>`. Además puede romper asserts del QA con tasa hardcodeada
  (p.ej. el de Jalisco, hoy `6h`).
- **Dos copias del runner.** `qa-runner/qa-anfitrion.js` (local, NO versionado) y
  `qa/qa-anfitrion.js` (en el repo). Deben quedar **idénticas** (salvo CRLF/LF) y
  ambas se actualizan juntas; solo la del repo se commitea.
- **Asserts del QA que envejecen** cuando cambia la app: ya pasó con `1f` (footer
  "Colmena" → "Expat Advisor MX") y `6h` (tasa de Jalisco). Si un cambio
  intencional rompe un assert, actualízalo para reflejar el nuevo valor correcto.

## Convenciones

- **i18n:** todo texto visible tiene clave en `TEXTS.es` y `TEXTS.en`. No hardcodear
  strings; reutilizar claves `label*`/`pdf*` existentes antes de crear duplicados.
- **Texto del PDF:** preferentemente **sin acentos** (convención del archivo:
  "Comision", "Regimen", "Calculos"). jsPDF/helvetica sí renderiza acentos WinAnsi
  (é/á/ó), por lo que reutilizar una clave `label*` acentuada es aceptable si evita
  duplicar; no introducir emojis (no son WinAnsi → texto roto).
- **Tasas ISH:** una sola tasa por estado, espejada en los 3 lugares de arriba.
  La **fuente de verdad** es el objeto `ESTADOS` en `public/index.html`. Verificar
  siempre contra **fuente primaria** (Ley de Hacienda/Ingresos estatal, `.gob.mx`);
  las secundarias (agregadores) a veces confunden ISH con otros impuestos.

## Mapa de archivos y entorno

- `public/index.html` — toda la app (lógica en `<script>` inline).
- `public/` — `sw.js`, `manifest.json`, iconos, `og-image.png`.
- `api/` — endpoints serverless (p.ej. `fx-usd` para tipo de cambio).
- `qa/qa-anfitrion.js` — runner de QA versionado (espejo de `qa-runner/`).
- `qa-runner/` (en `C:\Users\pvrol\qa-runner`) — copia local de ejecución + reportes.
- `browser-duendes/` (en `C:\Users\pvrol\browser-duendes`) — servicio Puppeteer (`:3847`).
- Entorno: Windows / PowerShell (Bash POSIX también disponible), Node v24, **sin `gh` CLI**
  (usar la API de GitHub vía `curl` si hace falta).

## Defaults de autoridad

- **Cosmético / implementación** (formato, naming, refactor de strings, fixes de UI):
  CC decide con un default razonable y **avisa** en su resumen.
- **Fiscal / modelado** (tasas ISH, `convenio`, regímenes, comisiones, umbrales,
  qué tasa aplicar en estados con tasa diferenciada): **espera confirmación explícita
  de Rolo.** En sesión autónoma (sin Rolo presente), **BLOQUEA y documenta la pregunta**
  — no toques tasas ni supuestos fiscales sin confirmación, aunque el contexto parezca obvio.
- **"Sin preferencia"** del owner → procede con la recomendación de CC y **documenta**
  la decisión tomada en el commit/resumen.
