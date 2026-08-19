import type { OrgAnalyticsDetail } from './types';
import { formatCountryStat } from './utils';

export function exportAnalyticsPdf(detail: OrgAnalyticsDetail, windowDays: number): string | null {
  const org = detail.organization || {};
  const slug = org.slug || 'org';
  const name = org.name || 'Organization';
  const rows = detail.by_brochure || [];
  const topCountries = (detail.countries || []).slice(0, 5).map((c) => formatCountryStat(c)).join(', ') || '—';
  const generated = new Date().toLocaleString();
  const fileTitle = `vsph-analytics-${slug}-30d`;
  const tableRows = rows.length
    ? rows
        .map((r) => {
          const title = r.title || r.filename || 'Untitled';
          const top = r.countries && r.countries[0] ? formatCountryStat(r.countries[0]) : '—';
          return `<tr>
          <td>${title}</td>
          <td>${r.project_name || '—'}</td>
          <td>${r.total || 0}</td>
          <td>${r.unique_visitors || 0}</td>
          <td>${top}</td>
        </tr>`;
        })
        .join('')
    : '<tr><td colspan="5">No brochures</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${fileTitle}</title>
  <style>
    body { font-family: Segoe UI, system-ui, sans-serif; color: #111827; margin: 32px; }
    h1 { font-size: 1.35rem; margin: 0 0 0.25rem; }
    .sub { color: #6b7280; font-size: 0.9rem; margin: 0 0 1.25rem; }
    .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.75rem 1rem; min-width: 120px; }
    .stat span { display: block; color: #6b7280; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .stat strong { font-size: 1.2rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; }
    th { color: #6b7280; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <p class="sub">VSPH PDF Viewer</p>
  <h1>${name} — analytics</h1>
  <p class="sub">/${slug} · Last ${windowDays} days · Generated ${generated}</p>
  <div class="stats">
    <div class="stat"><span>Brochures</span><strong>${detail.brochure_count != null ? detail.brochure_count : rows.length}</strong></div>
    <div class="stat"><span>Opens</span><strong>${detail.total || 0}</strong></div>
    <div class="stat"><span>Unique</span><strong>${detail.unique_visitors || 0}</strong></div>
  </div>
  <p class="sub">Top countries: ${topCountries}</p>
  <table>
    <thead><tr><th>PDF</th><th>Project</th><th>Opens</th><th>Unique</th><th>Top country</th></tr></thead>
    <tbody>${tableRows}</tbody>
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
