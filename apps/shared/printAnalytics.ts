import type { AnalyticsPayload } from './analytics';
import {
  countryLabel,
  formatCountryStat,
  formatDayLabel,
  formatDelta,
  formatLastOpened,
  formatShare,
  brochureMatchesCountry,
} from './analytics';

export interface AnalyticsExportOptions {
  days?: number;
  countryFilter?: string | null;
}

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c
  ));
}

export function exportAnalyticsPdf(
  detail: AnalyticsPayload,
  windowDays = 30,
  opts: AnalyticsExportOptions = {},
): string | null {
  const org = detail.organization || {};
  const slug = org.slug || 'org';
  const name = org.name || 'Organization';
  const days = opts.days || detail.window_days || windowDays;
  const countryFilter = opts.countryFilter || null;
  const filterLabel = countryFilter
    ? countryLabel(detail.countries?.find((c) => c.country === countryFilter) || countryFilter)
    : null;

  let rows = detail.by_brochure || [];
  if (countryFilter) {
    rows = rows.filter((r) => brochureMatchesCountry(r, countryFilter));
  }

  const countries = detail.countries || [];
  const projects = detail.by_project || [];
  const generated = new Date().toLocaleString();
  const fileTitle = `vsph-analytics-${slug}-${days}d`;
  const filteredTotal = rows.reduce((sum, r) => sum + (r.total || 0), 0);

  const deltaLine = detail.delta
    ? `Opens ${formatDelta(detail.delta.opens_pct)} · Unique ${formatDelta(detail.delta.unique_pct)} vs prior ${days} days`
    : '';

  const brochureRows = rows.length
    ? rows.map((r, i) => {
      const title = r.title || r.filename || 'Untitled';
      const top = r.countries && r.countries[0] ? formatCountryStat(r.countries[0]) : '—';
      const share = formatShare(r.total || 0, filteredTotal || detail.total || 0, r.share);
      return `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(title)}</td>
          <td>${escapeHtml(r.project_name || '—')}</td>
          <td>${r.total || 0}</td>
          <td>${r.unique_visitors || 0}</td>
          <td>${share}</td>
          <td>${escapeHtml(top)}</td>
          <td>${escapeHtml(formatLastOpened(r.last_opened_at))}</td>
        </tr>`;
    }).join('')
    : '<tr><td colspan="8">No brochure opens in this window</td></tr>';

  const countryRows = countries.length
    ? countries.map((c, i) => `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(countryLabel(c))}</td>
        <td>${c.count || 0}</td>
        <td>${formatShare(c.count, detail.total || 0, c.share)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4">No country data</td></tr>';

  const projectRows = projects.length
    ? projects.map((p, i) => `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(p.project_name || '—')}</td>
        <td>${p.total || 0}</td>
        <td>${p.unique_visitors || 0}</td>
        <td>${formatShare(p.total || 0, detail.total || 0, p.share)}</td>
      </tr>`).join('')
    : '<tr><td colspan="5">No project data</td></tr>';

  const filterNote = filterLabel
    ? `<p class="sub filter-note">Filtered to ${escapeHtml(filterLabel)}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(fileTitle)}</title>
  <style>
    body { font-family: Segoe UI, system-ui, sans-serif; color: #111827; margin: 32px; }
    h1 { font-size: 1.35rem; margin: 0 0 0.25rem; }
    h2 { font-size: 1rem; margin: 1.4rem 0 0.5rem; }
    .sub { color: #6b7280; font-size: 0.9rem; margin: 0 0 1.25rem; }
    .filter-note { color: #3257f6; font-weight: 600; }
    .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.75rem 1rem; min-width: 120px; }
    .stat span { display: block; color: #6b7280; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .stat strong { font-size: 1.2rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; }
    th { color: #6b7280; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <p class="sub">VSPH PDF Viewer</p>
  <h1>${escapeHtml(name)} — analytics${filterLabel ? ` (filtered to ${escapeHtml(filterLabel)})` : ''}</h1>
  <p class="sub">/${escapeHtml(slug)} · Last ${days} days · Generated ${escapeHtml(generated)}</p>
  ${filterNote}
  ${deltaLine ? `<p class="sub">${escapeHtml(deltaLine)}</p>` : ''}
  <div class="stats">
    <div class="stat"><span>Brochures opened</span><strong>${rows.length}</strong></div>
    <div class="stat"><span>Opens</span><strong>${countryFilter ? filteredTotal : (detail.total || 0)}</strong></div>
    <div class="stat"><span>Unique</span><strong>${detail.unique_visitors || 0}</strong></div>
    <div class="stat"><span>Peak day</span><strong>${detail.peak ? escapeHtml(formatDayLabel(detail.peak.date)) : '—'}</strong></div>
    <div class="stat"><span>Opens / unique</span><strong>${detail.opens_per_unique ?? '—'}</strong></div>
  </div>
  <h2>Countries visited</h2>
  <table>
    <thead><tr><th>#</th><th>Country</th><th>Opens</th><th>Share</th></tr></thead>
    <tbody>${countryRows}</tbody>
  </table>
  <h2>Projects ranked</h2>
  <table>
    <thead><tr><th>#</th><th>Project</th><th>Opens</th><th>Unique</th><th>Share</th></tr></thead>
    <tbody>${projectRows}</tbody>
  </table>
  <h2>Most opened brochures</h2>
  <table>
    <thead><tr><th>#</th><th>PDF</th><th>Project</th><th>Opens</th><th>Unique</th><th>Share</th><th>Top country</th><th>Last opened</th></tr></thead>
    <tbody>${brochureRows}</tbody>
  </table>
  <script>window.addEventListener("load", function () { window.print(); });<\/script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) return 'Allow pop-ups to export the PDF report, then use Save as PDF in the print dialog.';
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  return null;
}
