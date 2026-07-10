import { tokens } from '@usual/tokens';
import type { RecipeResult } from './pipeline';

export interface ReviewEntry {
  file: string;
  raw: {
    cuisine?: unknown;
    slotAffinity?: unknown;
    effort?: unknown;
    servings?: unknown;
    steps?: unknown;
  };
  result: RecipeResult;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );
}

function cssVars(theme: 'light' | 'dark'): string {
  return Object.entries(tokens.color[theme])
    .map(([k, v]) => `--c-${k}: ${v};`)
    .join(' ');
}

function statusColor(status: RecipeResult['status']): string {
  if (status === 'ready') return 'var(--c-success)';
  if (status === 'needs_review') return 'var(--c-warning)';
  return 'var(--c-danger)';
}
function statusLabel(status: RecipeResult['status']): string {
  return status === 'ready' ? 'Ready' : status === 'needs_review' ? 'Needs review' : 'Rejected';
}

function chip(text: string): string {
  return `<span class="chip">${esc(text)}</span>`;
}

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

function ingredientRows(result: RecipeResult): string {
  const rows = result.macros?.perIngredient ?? [];
  if (rows.length === 0) return '<tr><td colspan="5" class="muted">no macros computed</td></tr>';
  return rows
    .map((p) => {
      const conf = `${Math.round(p.confidence * 100)}%`;
      const confClass = p.confidence >= 0.9 ? 'ok' : p.per100g ? 'warn' : 'bad';
      const desc = p.matchedDescription ?? '— unresolved —';
      return `<tr>
        <td>${esc(p.name)}</td>
        <td class="num">${Math.round(p.qty_g)}g</td>
        <td class="desc">${esc(desc)}${p.fdcId != null ? ` <span class="fdc">#${p.fdcId}</span>` : ''}</td>
        <td class="num ${confClass}">${conf}</td>
        <td class="num">${Math.round(p.contribution.kcal)}</td>
      </tr>`;
    })
    .join('');
}

function card(entry: ReviewEntry): string {
  const { result, raw } = entry;
  const ps = result.perServingRounded;
  const slots = asArray(raw.slotAffinity);
  const steps = asArray(raw.steps);
  const metaChips = [
    raw.cuisine ? esc(String(raw.cuisine)) : null,
    ...slots,
    raw.effort ? esc(String(raw.effort)) : null,
    raw.servings ? `serves ${esc(String(raw.servings))}` : null,
  ]
    .filter(Boolean)
    .map((t) => chip(String(t)))
    .join('');

  const macros = ps
    ? `<div class="macros">
         <div class="kcal"><b>${ps.kcal}</b><span>kcal / serving</span></div>
         <div class="mrow">
           <span class="m"><b>${ps.protein_g}</b>g protein</span>
           <span class="m"><b>${ps.carbs_g}</b>g carbs</span>
           <span class="m"><b>${ps.fat_g}</b>g fat</span>
         </div>
       </div>`
    : '<div class="macros"><div class="kcal muted">no macros</div></div>';

  const dev = result.verification
    ? `<span class="dev ${result.verification.passes ? 'ok' : 'bad'}">Δ ${(result.verification.deviationPct * 100).toFixed(1)}%</span>`
    : '';

  const allergens = result.allergens.length
    ? `<div class="allergens">⚠ ${result.allergens.map((a) => esc(a)).join(' · ')}</div>`
    : '';

  const reasons = result.reviewReasons.length
    ? `<ul class="reasons">${result.reviewReasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
    : '';

  const stepsHtml = steps.length
    ? `<details class="steps"><summary>How to make it (${steps.length} steps)</summary><ol>${steps
        .map((s) => `<li>${esc(s)}</li>`)
        .join('')}</ol></details>`
    : '';

  return `<article class="card" style="--status:${statusColor(result.status)}">
    <header>
      <span class="badge" style="background:${statusColor(result.status)}">${statusLabel(result.status)}</span>
      <h2>${esc(result.name ?? entry.file)}</h2>
      ${dev}
    </header>
    <div class="meta">${metaChips}</div>
    ${macros}
    ${allergens}
    ${reasons}
    <details class="ings"><summary>Ingredients &amp; FDC traceability</summary>
      <div class="tablewrap"><table>
        <thead><tr><th>ingredient</th><th class="num">qty</th><th>resolved FDC food</th><th class="num">conf</th><th class="num">kcal</th></tr></thead>
        <tbody>${ingredientRows(result)}</tbody>
      </table></div>
    </details>
    ${stepsHtml}
  </article>`;
}

export function buildReviewHtml(entries: ReviewEntry[]): string {
  const ready = entries.filter((e) => e.result.status === 'ready').length;
  const review = entries.filter((e) => e.result.status === 'needs_review').length;
  const reject = entries.filter((e) => e.result.status === 'rejected').length;

  let ingTotal = 0;
  let ingAuto = 0;
  let atwaterChecked = 0;
  let atwaterPass = 0;
  for (const e of entries) {
    for (const r of e.result.resolutions) {
      ingTotal++;
      if (!r.needsReview && r.fdcId != null) ingAuto++;
    }
    if (e.result.verification && e.result.macros && e.result.macros.unresolved.length === 0) {
      atwaterChecked++;
      if (e.result.verification.passes) atwaterPass++;
    }
  }

  // rejected first (need attention), then review, then ready
  const order: Record<RecipeResult['status'], number> = { rejected: 0, needs_review: 1, ready: 2 };
  const sorted = [...entries].sort((a, b) => order[a.result.status] - order[b.result.status]);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Usual — catalogue review</title>
<style>
  :root { ${cssVars('light')}
    --radius: 14px; --gap: 16px;
    font-family: -apple-system, system-ui, sans-serif;
  }
  @media (prefers-color-scheme: dark) { :root { ${cssVars('dark')} } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--c-bg); color: var(--c-textPrimary); padding: 28px 20px 64px; }
  .wrap { max-width: 1040px; margin: 0 auto; }
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -0.02em; }
  .sub { color: var(--c-textSecondary); margin: 0 0 24px; font-size: 14px; }
  .summary { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 28px; }
  .stat { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 12px; padding: 12px 16px; }
  .stat b { font-size: 22px; display: block; }
  .stat span { color: var(--c-textSecondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--gap); }
  .card { background: var(--c-surface); border: 1px solid var(--c-border); border-left: 4px solid var(--status);
          border-radius: var(--radius); padding: 16px; }
  .card header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .card h2 { font-size: 17px; margin: 0; flex: 1 1 auto; letter-spacing: -0.01em; }
  .badge { color: #fff; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.03em; }
  .dev { font-size: 12px; font-weight: 600; padding: 2px 7px; border-radius: 999px; background: var(--c-surfaceSunken); }
  .dev.ok { color: var(--c-success); } .dev.bad { color: var(--c-danger); }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .chip { font-size: 11px; background: var(--c-accentSubtle); color: var(--c-accentSubtleText); padding: 3px 8px; border-radius: 999px; }
  .macros { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid var(--c-border); }
  .kcal b { font-size: 28px; } .kcal span { color: var(--c-textSecondary); font-size: 12px; margin-left: 6px; }
  .mrow { display: flex; gap: 12px; color: var(--c-textSecondary); font-size: 13px; }
  .mrow b { color: var(--c-textPrimary); }
  .allergens { color: var(--c-warning); font-size: 12px; font-weight: 600; margin: 4px 0; }
  .reasons { margin: 8px 0; padding: 8px 8px 8px 24px; background: var(--c-surfaceSunken); border-radius: 8px; font-size: 12px; color: var(--c-textSecondary); }
  details { margin-top: 8px; }
  summary { cursor: pointer; font-size: 13px; color: var(--c-accent); font-weight: 600; }
  .tablewrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th { text-align: left; color: var(--c-textMuted); font-weight: 600; border-bottom: 1px solid var(--c-border); padding: 4px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid var(--c-border); vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.desc { color: var(--c-textSecondary); } .fdc { color: var(--c-textMuted); }
  td.ok { color: var(--c-success); } td.warn { color: var(--c-warning); } td.bad { color: var(--c-danger); }
  .muted { color: var(--c-textMuted); }
  .steps ol { margin: 8px 0; padding-left: 20px; font-size: 13px; color: var(--c-textSecondary); }
  .steps li { margin: 3px 0; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Catalogue review</h1>
  <p class="sub">Generated by the recipe pipeline (§4.5). Every macro is computed deterministically from USDA FoodData Central — nothing here is AI-guessed. Nothing reaches “live” without human approval.</p>
  <div class="summary">
    <div class="stat"><b>${entries.length}</b><span>recipes</span></div>
    <div class="stat"><b style="color:var(--c-success)">${ready}</b><span>ready</span></div>
    <div class="stat"><b style="color:var(--c-warning)">${review}</b><span>needs review</span></div>
    <div class="stat"><b style="color:var(--c-danger)">${reject}</b><span>rejected</span></div>
    <div class="stat"><b>${ingAuto}/${ingTotal}</b><span>ingredients auto-matched</span></div>
    <div class="stat"><b>${atwaterPass}/${atwaterChecked}</b><span>pass ≤5% energy check</span></div>
  </div>
  <div class="grid">
    ${sorted.map(card).join('\n')}
  </div>
</div>
</body>
</html>`;
}
