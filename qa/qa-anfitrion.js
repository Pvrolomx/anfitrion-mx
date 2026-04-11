/**
 * QA RUNNER — Anfitrión MX
 * ============================================================
 * Corre todas las pruebas sin intervención manual.
 * Requiere: node server.js corriendo en browser-duendes (puerto 3847)
 *
 * Uso:    node qa-anfitrion.js
 * Output: qa-report-YYYY-MM-DD.md en C:\Users\pvrol\qa-runner\
 *
 * Suites:
 *   1 — HTTP / Carga
 *   2 — Sintaxis JavaScript
 *   3 — SEO / Meta tags
 *   4 — PWA (manifest, sw.js, icons)
 *   5 — Seguridad
 *   6 — Lógica fiscal / matemática
 *   7 — i18n ES/EN
 *   8 — Browser Engine (render real con Puppeteer)
 *   9 — Tipo de cambio API
 * ============================================================
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

// ─── Config ──────────────────────────────────────────────────
const URL_PROD    = 'https://anfitrion.expatadvisormx.com';
const URL_VERCEL  = 'https://anfitrion-mx.vercel.app';
const BROWSER_API = 'http://localhost:3847';
const API_KEY     = 'duendes-browser-2026';
const REPORT_DIR  = path.join(__dirname);

// ─── State ───────────────────────────────────────────────────
const results  = [];
const bugs     = [];
let passed = 0, failed = 0, warned = 0;
const startTime = Date.now();

// ─── Helpers ─────────────────────────────────────────────────
function log(msg) { process.stdout.write(msg + '\n'); }

function result(id, area, test, status, detail = '') {
  const e = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  if      (status === 'PASS') passed++;
  else if (status === 'FAIL') failed++;
  else                        warned++;
  results.push({ id, area, test, status, detail });
  log(`  ${e} [${id}] ${test}${detail ? ' — ' + detail : ''}`);
}

function bug(sev, title, detail) {
  bugs.push({ sev, title, detail });
  log(`       ${sev} BUG DETECTADO: ${title}`);
}

function fetchUrl(url, opts = {}) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, {
      method: opts.method || 'GET',
      headers: opts.headers || {},
      timeout: 20000,
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error',   e => resolve({ status: 0, error: e.message, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout', body: '' }); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function browserPost(endpoint, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = http.request(`${BROWSER_API}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try   { resolve({ ok: res.statusCode < 400, data: JSON.parse(data) }); }
        catch { resolve({ ok: false, data: { raw: data.substring(0, 200) } }); }
      });
    });
    req.on('error',   e => resolve({ ok: false, data: { error: e.message } }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, data: { error: 'timeout' } }); });
    req.write(body);
    req.end();
  });
}

function checkSyntax(jsCode) {
  const tmp = path.join(require('os').tmpdir(), 'qa_syntax_check.js');
  fs.writeFileSync(tmp, jsCode);
  try {
    execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr?.toString() || e.message };
  }
}

function extractInlineScript(html) {
  const matches = html.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g) || [];
  const scripts = matches.map(s => s.replace(/<\/?script[^>]*>/g, '').trim());
  return scripts.reduce((a, b) => b.length > a.length ? b : a, '');
}

// ─── Suite 1: HTTP / Carga ───────────────────────────────────
async function suite1_HTTP() {
  log('\n📡 SUITE 1 — HTTP / Carga');

  const [rProd, rVercel] = await Promise.all([fetchUrl(URL_PROD), fetchUrl(URL_VERCEL)]);

  result('1a', 'HTTP', 'HTTP 200 dominio custom',   rProd.status   === 200 ? 'PASS' : 'FAIL', `status=${rProd.status}`);
  result('1b', 'HTTP', 'HTTP 200 dominio Vercel',   rVercel.status === 200 ? 'PASS' : 'FAIL', `status=${rVercel.status}`);

  const html = rProd.body || '';

  // Contenido idéntico
  const sameSize = Math.abs(html.length - rVercel.body.length) < 100;
  result('1c', 'HTTP', 'Contenido idéntico en ambos dominios', sameSize ? 'PASS' : 'WARN',
    `custom=${html.length}b vercel=${rVercel.body.length}b`);

  // Estructura básica
  result('1d', 'Carga', 'Título correcto',
    html.includes('Anfitrion MX') || html.includes('Anfitrión MX') ? 'PASS' : 'FAIL');

  result('1e', 'Carga', 'Header 🏠 Anfitrion MX',
    html.includes('Anfitrion MX') ? 'PASS' : 'FAIL');

  // Footer: puede estar en <a> o texto plano
  result('1f', 'Carga', 'Footer Colmena 2026',
    html.includes('Colmena') && html.includes('2026') ? 'PASS' : 'FAIL');

  // Cards (buscar por class="card" o variante)
  const cardCount = (html.match(/class="card["\s]/g) || []).length;
  result('1g', 'Carga', `3+ cards presentes (${cardCount} encontrados)`,
    cardCount >= 3 ? 'PASS' : 'FAIL');

  // Botón calcular
  result('1h', 'Carga', 'Botón #btnCalcular en HTML',
    html.includes('id="btnCalcular"') ? 'PASS' : 'FAIL');

  // Disclaimer visible
  result('1i', 'Carga', 'Elemento disclaimer en HTML',
    html.includes('disclaimer') ? 'PASS' : 'FAIL');

  return html;
}

// ─── Suite 2: Sintaxis JS ────────────────────────────────────
async function suite2_Syntax(html) {
  log('\n🔍 SUITE 2 — Sintaxis JavaScript');

  const js = extractInlineScript(html);
  result('2a', 'JS', 'Script inline encontrado', js.length > 1000 ? 'PASS' : 'FAIL', `${js.length} chars`);
  if (!js) return null;

  // node --check
  const check = checkSyntax(js);
  result('2b', 'JS', 'Sintaxis válida (node --check)', check.ok ? 'PASS' : 'FAIL',
    check.ok ? 'sin errores' : check.error?.split('\n').find(l => l.includes('Error')) || check.error?.substring(0, 80));

  if (!check.ok) {
    bug('🔴', 'SyntaxError en script principal — app 100% inoperable',
      check.error?.split('\n').slice(0, 2).join(' ') || 'ver node --check output');
  }

  // Funciones críticas
  const criticalFuncs = ['calcular', 'setCredits', 'getCredits', 'generatePDF', 'mostrarResultados', 'updateLanguage', 'fetchTipoCambio'];
  for (const fn of criticalFuncs) {
    const present = js.includes(`function ${fn}`) || js.includes(`${fn}(`);
    result(`2c`, 'JS', `Función ${fn}()`, present ? 'PASS' : 'FAIL');
  }

  // generatePDF tiene try{ (bug histórico: faltaba el try)
  const pdfStart = js.indexOf('generatePDF');
  if (pdfStart !== -1) {
    const pdfBody = js.substring(pdfStart, pdfStart + 3000);
    const hasTry  = pdfBody.includes('try{') || pdfBody.includes('try {');
    result('2d', 'JS', 'generatePDF() tiene bloque try{',  hasTry ? 'PASS' : 'FAIL',
      hasTry ? '' : 'FALTA try{ — rompe todo el script');
    if (!hasTry) bug('🔴', 'generatePDF sin try{ — SyntaxError bloquea calcular()',
      'Insertar try{ después de btn.innerHTML="⏳..."');
  }

  // setCredits tiene const t = TEXTS (bug histórico)
  const setCreditsMatch = js.match(/function setCredits\([^)]*\)\{([^}]{0,300})/);
  if (setCreditsMatch) {
    const body = setCreditsMatch[1];
    const hasT  = body.includes('TEXTS[') || body.includes('const t=') || body.includes('const t =');
    result('2e', 'JS', 'setCredits() declara const t = TEXTS[...]', hasT ? 'PASS' : 'FAIL',
      hasT ? '' : 'FALTA — ReferenceError al calcular');
    if (!hasT && body.includes('t.regimen'))
      bug('🔴', 'setCredits() usa t sin declararlo', 'Agregar: const t = TEXTS[currentLang];');
  }

  // getCredits: debe retornar valor numérico
  const gcMatch = js.match(/function getCredits\(\)\{([^}]{0,150})\}/);
  if (gcMatch) {
    const gcBody = gcMatch[1];
    const isUsable = gcBody.includes('999') || gcBody.includes('localStorage');
    result('2f', 'JS', 'getCredits() retorna valor válido', isUsable ? 'PASS' : 'WARN', gcBody.trim());
  }

  return js;
}

// ─── Suite 3: SEO / Meta ─────────────────────────────────────
async function suite3_SEO(html) {
  log('\n🔎 SUITE 3 — SEO / Meta');

  const metaChecks = [
    ['3a', '<title>',          html.includes('<title>') && html.includes('</title>')],
    ['3b', 'meta description', html.includes('name="description"')],
    ['3c', 'og:title',         html.includes('og:title')],
    ['3d', 'og:description',   html.includes('og:description')],
    ['3e', 'og:image',         html.includes('og:image')],
    ['3f', 'og:url',           html.includes('og:url')],
    ['3g', 'twitter:card',     html.includes('twitter:card')],
    ['3h', 'manifest link',    html.includes('manifest.json')],
    ['3i', 'theme-color',      html.includes('theme-color')],
  ];
  for (const [id, name, ok] of metaChecks) {
    result(id, 'SEO', `Meta: ${name}`, ok ? 'PASS' : 'FAIL');
  }

  // og:image accesible
  const ogImg = (html.match(/og:image[^>]*content="([^"]+)"/) ||
                 html.match(/content="([^"]+)"[^>]*og:image/))?.[1];
  if (ogImg) {
    result('3j', 'SEO', 'og:image URL encontrada', 'PASS', ogImg.substring(0, 60));
    const imgR = await fetchUrl(ogImg);
    result('3k', 'SEO', 'og:image HTTP 200', imgR.status === 200 ? 'PASS' : 'FAIL', `status=${imgR.status}`);
  } else {
    result('3j', 'SEO', 'og:image URL encontrada', 'FAIL');
  }
}

// ─── Suite 4: PWA ────────────────────────────────────────────
async function suite4_PWA() {
  log('\n📱 SUITE 4 — PWA');

  const assets = ['/manifest.json', '/sw.js', '/icon-192.png', '/icon-512.png', '/privacy.html'];
  const resps = await Promise.all(assets.map(p => fetchUrl(URL_PROD + p)));

  assets.forEach((p, i) => {
    result(`4${String.fromCharCode(97+i)}`, 'PWA', `${p} HTTP 200`,
      resps[i].status === 200 ? 'PASS' : 'FAIL', `status=${resps[i].status}`);
  });

  // Manifest content
  if (resps[0].status === 200) {
    try {
      const m = JSON.parse(resps[0].body);
      result('4f', 'PWA', 'manifest.name presente',     m.name      ? 'PASS' : 'FAIL', m.name);
      result('4g', 'PWA', 'manifest.start_url = "/"',   m.start_url === '/' ? 'PASS' : 'WARN', m.start_url);
      result('4h', 'PWA', 'manifest: 2 icons (192/512)', m.icons?.length >= 2 ? 'PASS' : 'FAIL',
        `${m.icons?.length} icon(s)`);
      result('4i', 'PWA', 'manifest.display = standalone',
        m.display === 'standalone' ? 'PASS' : 'WARN', m.display);
    } catch { result('4f', 'PWA', 'manifest.json es JSON válido', 'FAIL'); }
  }
}

// ─── Suite 5: Seguridad ──────────────────────────────────────
async function suite5_Security(html) {
  log('\n🔒 SUITE 5 — Seguridad');

  // Patrones de API keys en source
  const keyPatterns = [
    /sk_live_[a-zA-Z0-9]{20,}/,
    /sk_test_[a-zA-Z0-9]{20,}/,
    /ghp_[a-zA-Z0-9]{36,}/,
    /AIza[0-9A-Za-z\-_]{35}/,
    /api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9\-_]{20,}/i,
  ];
  const keysFound = keyPatterns.some(p => p.test(html));
  result('5a', 'Seg', 'Sin API keys expuestas en source', !keysFound ? 'PASS' : 'FAIL');
  if (keysFound) bug('🔴', 'API key expuesta en HTML público', 'Revocar inmediatamente');

  // HTTPS redirect
  const httpR = await fetchUrl('http://anfitrion-mx.vercel.app');
  result('5b', 'Seg', 'HTTP → HTTPS redirect (301/308)',
    [301, 302, 308].includes(httpR.status) ? 'PASS' : 'WARN', `status=${httpR.status}`);

  // Mixed content
  const mixedCount = (html.match(/(?:src|href|action)="http:\/\//g) || []).length;
  result('5c', 'Seg', 'Sin mixed content HTTP en HTTPS',
    mixedCount === 0 ? 'PASS' : 'FAIL', `${mixedCount} ref. inseguras`);

  // Inputs numéricos (previene XSS nativo)
  const numInputs = (html.match(/type="number"/g) || []).length;
  result('5d', 'Seg', `Inputs type="number" (sanitizan XSS)`,
    numInputs >= 4 ? 'PASS' : 'WARN', `${numInputs} inputs`);

  // inputmode="decimal" para mobile (UX bug conocido)
  const hasInputmode = html.includes('inputmode=');
  result('5e', 'Seg', 'inputmode="decimal" en inputs (mobile UX)',
    hasInputmode ? 'PASS' : 'WARN', hasInputmode ? '' : 'Agregar inputmode="decimal" para teclado numérico en iOS/Android');
}

// ─── Suite 6: Lógica fiscal ──────────────────────────────────
async function suite6_Fiscal(html) {
  log('\n🧮 SUITE 6 — Lógica fiscal / matemática');

  // COMISIONES — buscar en JS minificado (puede ser airbnb:0.03 o airbnb':0.03)
  const comisionChecks = [
    ['6a', 'Airbnb 3%',    ['airbnb:0.03',   "airbnb':0.03",  'airbnb":0.03']],
    ['6b', 'Airbnb 15.5%', ['airbnb15:0.155','airbnb15\':0.155', '0.155']],
    ['6c', 'Vrbo 8%',      ['vrbo:0.08',     "vrbo':0.08"]],
    ['6d', 'Booking 15%',  ['booking:0.15',  "booking':0.15"]],
    ['6e', 'Directa 0%',   ['directa:0,',    "directa':0,", 'directa:0}']],
  ];
  for (const [id, name, patterns] of comisionChecks) {
    const ok = patterns.some(p => html.includes(p));
    result(id, 'Fiscal', `COMISIONES ${name}`, ok ? 'PASS' : 'FAIL');
  }

  // RESICO ISR 4%
  const resicoISR4 = html.includes('RESICO') && html.includes('isr:0.04');
  result('6f', 'Fiscal', 'RESICO ISR = 4%', resicoISR4 ? 'PASS' : 'FAIL');

  // JALISCO — en HTML puede estar como data-attribute o en JS object
  // data-convenio="true" y data-rate="3" en el option de JALISCO
  const jalHtml = html.match(/JALISCO[^>]{0,200}/)?.[0] || '';
  const hasJalConvenio = jalHtml.includes('convenio="true"') || jalHtml.includes('convenio:true') ||
                         jalHtml.includes('data-convenio="true"');
  const hasJalISH3     = jalHtml.includes('rate="3"') || jalHtml.includes('ish:0.03') ||
                         jalHtml.includes('data-rate="3"');
  result('6g', 'Fiscal', 'JALISCO convenio Airbnb = true', hasJalConvenio ? 'PASS' : 'FAIL');
  result('6h', 'Fiscal', 'JALISCO ISH = 3%',               hasJalISH3     ? 'PASS' : 'FAIL');

  // Nayarit sin convenio
  const nayHtml = html.match(/NAYARIT[^>]{0,150}/)?.[0] || '';
  const nayNoConv = nayHtml.includes('convenio="false"') || nayHtml.includes('convenio:false') ||
                    nayHtml.includes('data-convenio="false"');
  result('6i', 'Fiscal', 'NAYARIT sin convenio = false', nayNoConv ? 'PASS' : 'FAIL');

  // 31 estados (contar options con data-convenio)
  const estadoCount = (html.match(/data-convenio=/g) || []).length;
  result('6j', 'Fiscal', `31 estados en dropdown (${estadoCount} encontrados)`,
    estadoCount >= 28 ? 'PASS' : 'FAIL');

  // Label Airbnb 15.5% — verificar el span platform-fee del botón airbnb15
  // Y también el aria-label de accesibilidad
  // Buscar específicamente en el contexto del botón airbnb15, no en aria-label genérico
  const airbnb15Btn = html.match(/data-platform="airbnb15"[^>]*>[\s\S]{0,100}/)?.[0] || '';
  const labelEsCorrecto = airbnb15Btn.includes('15.5%');
  const rateTiene155    = html.includes('airbnb15:0.155') || html.includes('0.155');
  result('6k', 'Fiscal', 'Label botón Airbnb 15.5% correcto',
    labelEsCorrecto ? 'PASS' : 'FAIL',
    labelEsCorrecto ? '' : 'platform-fee muestra "15%" pero rate real es 15.5%');
  if (!labelEsCorrecto && rateTiene155) {
    bug('🟡', 'Label botón "Airbnb 15%" incorrecto — rate real es 15.5%',
      'En el HTML, cambiar: <span class="platform-fee">15.5%</span>');
  }

  // Warning RESICO+plataformas
  result('6l', 'Fiscal', 'Warning RESICO+plataformas presente',
    html.includes('warningResico') ? 'PASS' : 'FAIL');

  // Nota Puerto Vallarta 2026
  result('6m', 'Fiscal', 'Nota Puerto Vallarta 2026 presente',
    html.includes('Puerto Vallarta') && html.includes('2026') ? 'PASS' : 'FAIL');
}

// ─── Suite 7: i18n ───────────────────────────────────────────
async function suite7_I18N(html) {
  log('\n🌐 SUITE 7 — i18n ES/EN');

  const esTexts = ['Calculadora para Anfitriones', 'Régimen fiscal', 'Ver cuánto me queda', 'Gastos operativos'];
  const enTexts = ['Calculator for Hosts', 'Tax regime', 'See what I keep', 'Operating expenses'];

  for (const t of esTexts) result('7a', 'i18n', `ES: "${t}"`, html.includes(t) ? 'PASS' : 'FAIL');
  for (const t of enTexts) result('7b', 'i18n', `EN: "${t}"`, html.includes(t) ? 'PASS' : 'FAIL');

  // Disclaimer ES — no debe ser placeholder de desarrollo
  // El placeholder contiene "Pendiente de implementación" o "reglamento de aplicación"
  const disclaimerES = html.match(/disclaimer:'([\s\S]{0,300}?)(?:',|',\s*\n)/)?.[1] || '';
  const isPlaceholder = disclaimerES.includes('Pendiente') || disclaimerES.includes('reglamento de aplicaci');
  result('7c', 'i18n', 'Disclaimer ES no es texto placeholder',
    !isPlaceholder ? 'PASS' : 'FAIL',
    isPlaceholder ? 'Contiene texto del aviso PV2026 en lugar de disclaimer fiscal' : '');
  if (isPlaceholder)
    bug('🟡', 'TEXTS.es.disclaimer apunta al aviso PV2026',
      'Cambiar a: "Cálculos aproximados con fines informativos. No constituyen asesoría fiscal."');

  // Disclaimer EN — debe ser el correcto
  const hasEnDisclaimer = html.includes('informational purposes') || html.includes('Not tax or legal advice');
  result('7d', 'i18n', 'Disclaimer EN correcto', hasEnDisclaimer ? 'PASS' : 'WARN');

  // Funciones i18n
  result('7e', 'i18n', 'updateLanguage() presente', html.includes('updateLanguage') ? 'PASS' : 'FAIL');
  result('7f', 'i18n', 'currentLang variable presente', html.includes('currentLang') ? 'PASS' : 'FAIL');
}

// ─── Suite 8: Browser Engine ─────────────────────────────────
async function suite8_Browser() {
  log('\n🖥️  SUITE 8 — Browser Engine (render real)');

  const health = await fetchUrl(`${BROWSER_API}/health`);
  if (health.status !== 200) {
    result('8a', 'Browser', 'Browser Engine /health', 'FAIL',
      'Engine offline — iniciar: cd browser-duendes && node server.js');
    log('  ⚠️  Saltando suite 8 (browser engine no disponible)');
    return;
  }
  result('8a', 'Browser', 'Browser Engine /health OK', 'PASS');

  // Screenshot
  log('  📸 Capturando screenshot...');
  const ss = await browserPost('/screenshot', { url: URL_PROD });
  result('8b', 'Browser', 'Screenshot sin error', ss.ok ? 'PASS' : 'FAIL',
    ss.ok ? `guardado en screenshots/` : JSON.stringify(ss.data).substring(0, 100));

  // DOM: elementos críticos
  const domChecks = [
    ['8c', '#btnCalcular',    'Botón Calcular en DOM real'],
    ['8d', '#results',        'Div #results en DOM real'],
    ['8e', '#regimenFiscal',  'Select régimen fiscal en DOM'],
    ['8f', '#estado',         'Select estados en DOM'],
    ['8g', '#tarifaNoche',    'Input tarifa/noche en DOM'],
  ];
  for (const [id, selector, label] of domChecks) {
    const r = await browserPost('/scrape', { url: URL_PROD, selector });
    result(id, 'Browser', label, r.ok ? 'PASS' : 'FAIL');
  }
}

// ─── Suite 9: FX API ─────────────────────────────────────────
async function suite9_FX() {
  log('\n💱 SUITE 9 — Tipo de cambio');

  const r = await fetchUrl(`${URL_PROD}/api/fx-usd`);
  result('9a', 'FX', '/api/fx-usd HTTP 200', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`);

  if (r.status === 200) {
    try {
      const data = JSON.parse(r.body);
      const tc   = parseFloat(data.tipoCambio);
      result('9b', 'FX', 'Campo tipoCambio en respuesta', !isNaN(tc) ? 'PASS' : 'FAIL');
      result('9c', 'FX', `TC en rango válido $15–$25 (actual: ${tc})`,
        (tc >= 15 && tc <= 25) ? 'PASS' : 'FAIL');
    } catch {
      result('9b', 'FX', 'Respuesta JSON válida', 'FAIL', r.body.substring(0, 80));
    }
  }
}

// ─── Reporte Markdown ─────────────────────────────────────────
function generateReport() {
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const date     = new Date().toISOString().split('T')[0];
  const total    = passed + failed + warned;

  let md = `# QA — Anfitrión MX\n\n`;
  md += `**Fecha:** ${new Date().toLocaleString('es-MX')}  \n`;
  md += `**Duración:** ${duration}s | **Total:** ${total} pruebas  \n`;
  md += `**Resultado:** ${passed} ✅ PASS | ${failed} ❌ FAIL | ${warned} ⚠️ WARN\n\n`;

  if (bugs.length > 0) {
    md += `---\n\n## 🐛 Bugs detectados (${bugs.length})\n\n`;
    for (const b of bugs) {
      md += `### ${b.sev} ${b.title}\n${b.detail}\n\n`;
    }
  } else {
    md += `> ✅ **Sin bugs — todo correcto**\n\n`;
  }

  md += `---\n\n## Resultados completos\n\n`;
  md += `| ID | Área | Prueba | Estado | Detalle |\n|---|---|---|---|---|\n`;
  for (const r of results) {
    const e = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    md += `| ${r.id} | ${r.area} | ${r.test} | ${e} ${r.status} | ${r.detail} |\n`;
  }

  md += `\n---\n*qa-anfitrion.js — La Colmena — ${date}*\n`;

  const filename = path.join(REPORT_DIR, `qa-report-${date}.md`);
  fs.writeFileSync(filename, md, 'utf8');
  return filename;
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  log('🐝 QA Runner — Anfitrión MX');
  log(`   ${URL_PROD}`);
  log('═'.repeat(50));

  const html = await suite1_HTTP();
  if (!html) { log('❌ Sin HTML — abortando'); process.exit(1); }

  await suite2_Syntax(html);
  await suite3_SEO(html);
  await suite4_PWA();
  await suite5_Security(html);
  await suite6_Fiscal(html);
  await suite7_I18N(html);
  await suite9_FX();
  await suite8_Browser();   // al final porque tarda más

  const total = passed + failed + warned;
  log('\n' + '═'.repeat(50));
  log(`✅ ${passed} PASS | ❌ ${failed} FAIL | ⚠️ ${warned} WARN | ${total} total`);

  if (bugs.length > 0) {
    log(`\n🐛 ${bugs.length} bug(s) detectado(s):`);
    bugs.forEach(b => log(`   ${b.sev} ${b.title}`));
  }

  const reportPath = generateReport();
  log(`\n📄 Reporte: ${reportPath}`);
  log(`⏱️  Duración: ${((Date.now() - startTime)/1000).toFixed(1)}s`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { log('💥 ERROR FATAL: ' + e.message); process.exit(1); });
