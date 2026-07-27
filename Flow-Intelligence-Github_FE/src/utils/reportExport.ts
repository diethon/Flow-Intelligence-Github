import type { AiBriefData } from "../api/briefApi";
import type { EvidenceCard } from "../types";
import type { UC10MetricsResult } from "../types/metrics";

export interface WeeklyReportData { brief: AiBriefData; repositoryName: string; evidenceCards: EvidenceCard[]; metrics: UC10MetricsResult | null }

const metricsOf = (m: UC10MetricsResult | null) => m ? [
  ["Review pickup (average)", m.reviewPickup.avgHours, "hours", m.reviewPickup.dataStatus],
  ["Review turnaround (average)", m.reviewTurnaround.avgHours, "hours", m.reviewTurnaround.dataStatus],
  ["Top reviewer concentration", m.reviewLoadConcentration.topReviewerPct, "%", m.reviewLoadConcentration.dataStatus],
  ["Failed check rate", m.failedCheckRate.failedRatePct, "%", m.failedCheckRate.dataStatus],
] as const : [];
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const html = (v: unknown) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const filename = (d: WeeklyReportData, ext: string) => `weekly-report-${d.repositoryName.replace(/[^a-z0-9_-]+/gi,"-")}-${d.brief.windowStart.slice(0,10)}.${ext}`;

export function exportWeeklyReportCsv(d: WeeklyReportData) {
  const rows: unknown[][] = [
    ["Section","Name","Value / Summary","Unit / Severity","Status / Confidence","Suggested action / Evidence IDs"],
    ["Report","Repository",d.repositoryName,"","",""],
    ["Report","Window",`${d.brief.windowStart} - ${d.brief.windowEnd}`,"",d.brief.status,""],
    ["Weekly Brief","Executive summary",d.brief.summary,"",d.brief.confidence,""],
    ...d.brief.items.map(i => ["Weekly Brief",i.title,i.detail,i.severity,i.type,i.evidenceCardIds.join("; ")]),
    ...metricsOf(d.metrics).map(([name,value,unit,status]) => ["KPI",name,value,unit,status,""]),
    ...d.evidenceCards.map(c => ["Evidence Card",c.title,c.summary,c.severity,c.confidence,c.suggestedAction]),
    ...d.brief.limitations.map((x,i) => ["Limitation",`Limitation ${i+1}`,x,"","",""]),
  ];
  const url = URL.createObjectURL(new Blob([`\uFEFF${rows.map(r=>r.map(csvCell).join(",")).join("\r\n")}`], {type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a"); a.href=url; a.download=filename(d,"csv"); a.click(); URL.revokeObjectURL(url);
}

export function exportWeeklyReportPdf(d: WeeklyReportData) {
  const win=window.open("","_blank");
  if(!win) throw new Error("Please allow pop-ups to export the PDF report.");
  win.opener = null;
  const items=d.brief.items.map(i=>`<article><h3>${html(i.title)} <span>${html(i.severity)}</span></h3><p>${html(i.detail)}</p></article>`).join("");
  const kpis=metricsOf(d.metrics).map(([n,v,u,s])=>`<tr><td>${html(n)}</td><td>${html(v??"No data")} ${html(v===null?"":u)}</td><td>${html(s)}</td></tr>`).join("");
  const cards=d.evidenceCards.map(c=>`<article><h3>${html(c.title)} <span>${html(c.severity)}</span></h3><p>${html(c.summary)}</p><p><b>Suggested action:</b> ${html(c.suggestedAction)}</p><small>Confidence: ${html(c.confidence)}</small></article>`).join("");
  win.document.write(`<!doctype html><html><head><title>${html(filename(d,"pdf"))}</title><style>@page{size:A4;margin:16mm}body{font:13px Arial;color:#172033;line-height:1.5}h1{margin-bottom:2px}h2{border-bottom:2px solid #4f46e5;padding-bottom:5px;margin-top:24px}h3{font-size:14px;margin:0}article{break-inside:avoid;border:1px solid #dbe2ea;border-radius:6px;padding:10px;margin:8px 0}span{font-size:10px;text-transform:uppercase;color:#4f46e5}table{width:100%;border-collapse:collapse}th,td{text-align:left;border:1px solid #dbe2ea;padding:7px}.meta,.footer{color:#64748b}.summary{font-size:15px}.footer{margin-top:24px;font-size:10px}</style></head><body><h1>Weekly Flow Intelligence Report</h1><p class="meta">${html(d.repositoryName)} · ${html(new Date(d.brief.windowStart).toLocaleDateString())} – ${html(new Date(d.brief.windowEnd).toLocaleDateString())}</p><h2>Executive Summary</h2><p class="summary">${html(d.brief.summary)}</p><h2>KPI</h2>${kpis?`<table><tr><th>Metric</th><th>Value</th><th>Status</th></tr>${kpis}</table>`:"<p>No KPI data available.</p>"}<h2>Weekly Brief</h2>${items||"<p>No brief items.</p>"}<h2>Evidence Cards (${d.evidenceCards.length})</h2>${cards||"<p>No evidence cards in this report window.</p>"}${d.brief.limitations.length?`<h2>Limitations</h2><ul>${d.brief.limitations.map(x=>`<li>${html(x)}</li>`).join("")}</ul>`:""}<p class="footer">Generated ${html(new Date().toLocaleString())} · Flow Intelligence</p><script>window.onload=()=>window.print()</script></body></html>`);
  win.document.close();
}
