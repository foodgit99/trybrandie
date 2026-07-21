import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { citationsForSignal, type SourceCitation } from "./competitorSources";

// Brandie default palette (overridable via `branding`)
const BEIGE = "#FAF8F5";
const CHARCOAL = "#2B2D33";
const DEFAULT_ACCENT = "#C4993B";
const MUTED = "#6B6B6B";
const SOFT = "#E7E2D8";

export type ReportBranding = {
  /** Report title used on cover + eyebrow (default "Competitor Deep Dive"). */
  reportTitle?: string | null;
  /** Hex accent color used for rules, highlights, badges, footer refs. */
  accentColor?: string | null;
  /** Optional logo to display on the cover in addition to the competitor logo. */
  brandLogoUrl?: string | null;
};

function normalizeHex(v: string | null | undefined, fallback: string): string {
  if (!v) return fallback;
  const s = v.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) return s.startsWith("#") ? s : `#${s}`;
  if (/^#?[0-9a-fA-F]{3}$/.test(s)) {
    const c = s.replace("#", "");
    return `#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`;
  }
  return fallback;
}

export type DeepCompetitor = {
  id: string;
  name: string;
  domain: string | null;
  instagram_handle: string | null;
  logo_url: string | null;
  discovery_source: "auto" | "user";
  discovery_rationale: string | null;
  last_scanned_at: string | null;
  created_at?: string | null;
};

export type DeepSignal = {
  id: string;
  signal_type: string;
  summary: string;
  rationale: string | null;
  content_idea_id: string | null;
  week_start_date: string;
  created_at?: string;
  metadata?: any;
};

export type DeepSnapshot = {
  source: "site" | "instagram" | string;
  week_start_date: string;
  scanned_at: string | null;
  extracted: any;
  error: string | null;
};

export type DeepIdea = {
  id: string;
  title: string;
  content_category: string | null;
  scheduled_for: string | null;
  campaign_rationale?: string | null;
  funnel_rationale?: string | null;
};

export type DeepBrand = { name: string; logo_url?: string | null };

const SIGNAL_LABELS: Record<string, string> = {
  steal_the_angle: "Steal the angle",
  seo_win: "SEO win",
  positioning_shift: "Positioning shift",
};

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function clip(s: string | null | undefined, n = 500): string {
  const t = (s ?? "").trim();
  if (!t) return "—";
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

export function buildRecommendedActions(
  competitor: DeepCompetitor,
  signals: DeepSignal[],
): { title: string; steps: string[] }[] {
  const byType = new Map<string, DeepSignal[]>();
  for (const s of signals) {
    const arr = byType.get(s.signal_type) ?? [];
    arr.push(s);
    byType.set(s.signal_type, arr);
  }
  const out: { title: string; steps: string[] }[] = [];

  if (byType.get("steal_the_angle")?.length) {
    out.push({
      title: "Steal the angle (this week)",
      steps: [
        `Pick the top 2 signals under "Steal the angle" and slot them into your Blueprint as Educational or Entertainment posts.`,
        `Rewrite the angle in your brand voice — do not copy captions verbatim. Lead with your customer's pain, then reveal the same insight.`,
        `Ship within 72 hours while the topic is still warm on ${competitor.name}'s audience.`,
      ],
    });
  }

  if (byType.get("seo_win")?.length) {
    out.push({
      title: "Close the SEO gap",
      steps: [
        `Audit the keywords ${competitor.name} is ranking for and identify 3 you can realistically target this quarter.`,
        `Publish a long-form piece (blog or landing page) around your strongest match — same intent, sharper POV.`,
        `Interlink the new page from your homepage and 2 existing posts to signal relevance.`,
      ],
    });
  }

  if (byType.get("positioning_shift")?.length) {
    out.push({
      title: "Counter the positioning shift",
      steps: [
        `Compare their new positioning to yours in one sentence — where do they now overlap with you?`,
        `Sharpen a single differentiator on your homepage hero and pricing page within the week.`,
        `Publish a "why we're different" post referencing the underlying customer job — not the competitor by name.`,
      ],
    });
  }

  if (out.length === 0) {
    out.push({
      title: "Establish a baseline",
      steps: [
        `Run a full scan on ${competitor.name} to build the first week of signals.`,
        `Note their hero message, top 3 offers, and content cadence in a private doc.`,
        `Revisit next Sunday — Brandie will surface what changed.`,
      ],
    });
  }

  return out;
}

function drawSignalBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  data: { label: string; value: number; color: string }[],
) {
  // Axis
  doc.setDrawColor(SOFT);
  doc.setLineWidth(0.5);
  doc.line(x, y + h, x + w, y + h);

  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = w / (data.length * 1.6);
  const gap = (w - barW * data.length) / (data.length + 1);
  data.forEach((d, i) => {
    const bx = x + gap + i * (barW + gap);
    const bh = ((h - 24) * d.value) / max;
    const by = y + h - bh;
    doc.setFillColor(d.color);
    doc.rect(bx, by, barW, bh, "F");

    // Value on top
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(CHARCOAL);
    doc.text(String(d.value), bx + barW / 2, by - 4, { align: "center" });

    // Label under
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text(d.label, bx + barW / 2, y + h + 12, { align: "center" });
  });
}

export async function buildCompetitorDeepReportPdf(args: {
  brand: DeepBrand;
  competitor: DeepCompetitor;
  signals: DeepSignal[];
  snapshots: DeepSnapshot[];
  ideas: DeepIdea[];
}): Promise<jsPDF> {
  const { brand, competitor, signals, snapshots, ideas } = args;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // ---------- Cover ----------
  doc.setFillColor(BEIGE);
  doc.rect(0, 0, pageW, pageH, "F");

  // Top eyebrow
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(accent);
  doc.text("BRANDIE · COMPETITOR DEEP DIVE", margin, margin);

  // Competitor logo
  let coverY = margin + 40;
  if (competitor.logo_url) {
    const data = await fetchImageDataUrl(competitor.logo_url);
    if (data) {
      try {
        doc.addImage(data, "PNG", margin, coverY, 72, 72);
      } catch {}
    }
  }

  // Name
  doc.setTextColor(CHARCOAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(competitor.name, margin, coverY + 110);

  // Meta line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(MUTED);
  const meta = [
    competitor.domain ?? null,
    competitor.instagram_handle ? `@${competitor.instagram_handle.replace(/^@/, "")}` : null,
    competitor.discovery_source === "auto" ? "Auto-discovered" : "Added by you",
  ]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(meta, margin, coverY + 132);

  // Gold rule
  doc.setDrawColor(accent);
  doc.setLineWidth(2);
  doc.line(margin, coverY + 152, margin + 80, coverY + 152);

  // Prepared for
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text(`Prepared for ${brand.name || "your brand"}`, margin, coverY + 180);
  doc.text(
    `Report date: ${new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    margin,
    coverY + 196,
  );
  doc.text(`Last scan: ${fmtDate(competitor.last_scanned_at)}`, margin, coverY + 212);

  // Discovery rationale block
  if (competitor.discovery_rationale) {
    doc.setFillColor(SOFT);
    doc.roundedRect(margin, coverY + 240, pageW - margin * 2, 90, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(CHARCOAL);
    doc.text("Why we're watching them", margin + 16, coverY + 262);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(CHARCOAL);
    const lines = doc.splitTextToSize(
      clip(competitor.discovery_rationale, 500),
      pageW - margin * 2 - 32,
    );
    doc.text(lines.slice(0, 4), margin + 16, coverY + 280);
  }

  // ---------- Signal breakdown ----------
  doc.addPage();
  doc.setFillColor(BEIGE);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(CHARCOAL);
  doc.text("Signal breakdown", margin, margin + 10);
  doc.setDrawColor(accent);
  doc.setLineWidth(1.5);
  doc.line(margin, margin + 18, margin + 60, margin + 18);

  const counts = {
    steal_the_angle: signals.filter((s) => s.signal_type === "steal_the_angle").length,
    seo_win: signals.filter((s) => s.signal_type === "seo_win").length,
    positioning_shift: signals.filter((s) => s.signal_type === "positioning_shift").length,
  };

  // Stat cards
  const cardY = margin + 40;
  const cardW = (pageW - margin * 2 - 24) / 3;
  const cards = [
    { label: "Steal the angle", value: counts.steal_the_angle, color: "#10B981" },
    { label: "SEO wins", value: counts.seo_win, color: "#3B82F6" },
    { label: "Positioning shifts", value: counts.positioning_shift, color: "#F59E0B" },
  ];
  cards.forEach((c, i) => {
    const cx = margin + i * (cardW + 12);
    doc.setFillColor("#FFFFFF");
    doc.roundedRect(cx, cardY, cardW, 78, 10, 10, "F");
    doc.setFillColor(c.color);
    doc.rect(cx, cardY, 4, 78, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(CHARCOAL);
    doc.text(String(c.value), cx + 18, cardY + 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    doc.text(c.label, cx + 18, cardY + 62);
  });

  // Bar chart
  const chartY = cardY + 110;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(CHARCOAL);
  doc.text("Signals by type", margin, chartY);
  drawSignalBarChart(
    doc,
    margin,
    chartY + 14,
    pageW - margin * 2,
    160,
    [
      { label: "Steal the angle", value: counts.steal_the_angle, color: "#10B981" },
      { label: "SEO win", value: counts.seo_win, color: "#3B82F6" },
      { label: "Positioning shift", value: counts.positioning_shift, color: "#F59E0B" },
    ],
  );

  // Weekly trend
  const weekMap = new Map<string, number>();
  for (const s of signals) {
    weekMap.set(s.week_start_date, (weekMap.get(s.week_start_date) ?? 0) + 1);
  }
  const weeks = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  if (weeks.length > 0) {
    const trendY = chartY + 210;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(CHARCOAL);
    doc.text("Signals per week", margin, trendY);
    drawSignalBarChart(
      doc,
      margin,
      trendY + 14,
      pageW - margin * 2,
      140,
      weeks.map(([w, v]) => ({
        label: fmtDate(w),
        value: v,
        color: accent,
      })),
    );
  }

  // ---------- Signals detail ----------
  doc.addPage();
  doc.setFillColor(BEIGE);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(CHARCOAL);
  doc.text("Every signal, in detail", margin, margin + 10);
  doc.setDrawColor(accent);
  doc.setLineWidth(1.5);
  doc.line(margin, margin + 18, margin + 60, margin + 18);

  // Assign a stable citation index across the report so [1], [2]… line up
  // between the signals table and the "Sources & citations" appendix.
  const citationIndex = new Map<string, number>();
  const orderedCitations: SourceCitation[] = [];
  function refsFor(sig: DeepSignal): number[] {
    const cites = citationsForSignal(sig, competitor);
    const nums: number[] = [];
    for (const c of cites) {
      let n = citationIndex.get(c.url);
      if (!n) {
        n = orderedCitations.length + 1;
        citationIndex.set(c.url, n);
        orderedCitations.push(c);
      }
      nums.push(n);
    }
    return nums;
  }

  if (signals.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(MUTED);
    doc.text(
      "No signals yet. Run a digest to surface what changed this week.",
      margin,
      margin + 50,
    );
  } else {
    autoTable(doc, {
      startY: margin + 34,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: {
        fillColor: CHARCOAL,
        textColor: BEIGE,
        fontSize: 9,
        fontStyle: "bold",
      },
      styles: { font: "helvetica", fontSize: 9, textColor: CHARCOAL, cellPadding: 7 },
      head: [["Week", "Signal", "What they did", "Why it matters", "Sources"]],
      body: signals.map((s) => [
        fmtDate(s.week_start_date),
        SIGNAL_LABELS[s.signal_type] ?? s.signal_type,
        clip(s.summary, 260),
        clip(s.rationale, 260),
        refsFor(s).map((n) => `[${n}]`).join(" ") || "—",
      ]),
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 82, fontStyle: "bold", textColor: accent },
        2: { cellWidth: 150 },
        4: { cellWidth: 54, textColor: accent, fontStyle: "bold" },
      },
    });
  }

  // ---------- Snapshot excerpts ----------
  const siteSnap = snapshots.find((s) => s.source === "site");
  const igSnap = snapshots.find((s) => s.source === "instagram");
  if (siteSnap?.extracted || igSnap?.extracted) {
    doc.addPage();
    doc.setFillColor(BEIGE);
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(CHARCOAL);
    doc.text("Their public surface", margin, margin + 10);
    doc.setDrawColor(accent);
    doc.setLineWidth(1.5);
    doc.line(margin, margin + 18, margin + 60, margin + 18);

    let sy = margin + 40;

    if (siteSnap?.extracted) {
      const ex = siteSnap.extracted as any;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(CHARCOAL);
      doc.text("Website snapshot", margin, sy);
      sy += 16;
      const rows: [string, string][] = [];
      if (ex.title) rows.push(["Title", clip(ex.title, 200)]);
      if (ex.description) rows.push(["Description", clip(ex.description, 300)]);
      if (ex.summary) rows.push(["Summary", clip(ex.summary, 500)]);
      if (ex.hero_copy) rows.push(["Hero copy", clip(ex.hero_copy, 400)]);
      if (rows.length > 0) {
        autoTable(doc, {
          startY: sy,
          margin: { left: margin, right: margin },
          theme: "plain",
          styles: { font: "helvetica", fontSize: 9, textColor: CHARCOAL, cellPadding: 6 },
          columnStyles: {
            0: { fontStyle: "bold", textColor: MUTED, cellWidth: 90 },
            1: { textColor: CHARCOAL },
          },
          body: rows,
        });
        // @ts-expect-error autotable augments
        sy = (doc.lastAutoTable?.finalY ?? sy) + 20;
      }
    }

    if (igSnap?.extracted) {
      const ex = igSnap.extracted as any;
      if (sy > pageH - 160) {
        doc.addPage();
        doc.setFillColor(BEIGE);
        doc.rect(0, 0, pageW, pageH, "F");
        sy = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(CHARCOAL);
      doc.text("Instagram snapshot", margin, sy);
      sy += 16;
      const rows: [string, string][] = [];
      if (ex.handle) rows.push(["Handle", `@${String(ex.handle).replace(/^@/, "")}`]);
      if (ex.summary) rows.push(["Summary", clip(ex.summary, 500)]);
      if (ex.bio_and_recent) rows.push(["Bio & recent", clip(ex.bio_and_recent, 500)]);
      if (rows.length > 0) {
        autoTable(doc, {
          startY: sy,
          margin: { left: margin, right: margin },
          theme: "plain",
          styles: { font: "helvetica", fontSize: 9, textColor: CHARCOAL, cellPadding: 6 },
          columnStyles: {
            0: { fontStyle: "bold", textColor: MUTED, cellWidth: 90 },
            1: { textColor: CHARCOAL },
          },
          body: rows,
        });
      }
    }
  }

  // ---------- Ideas ----------
  if (ideas.length > 0) {
    doc.addPage();
    doc.setFillColor(BEIGE);
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(CHARCOAL);
    doc.text("What to steal this week", margin, margin + 10);
    doc.setDrawColor(accent);
    doc.setLineWidth(1.5);
    doc.line(margin, margin + 18, margin + 60, margin + 18);

    autoTable(doc, {
      startY: margin + 34,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: CHARCOAL, textColor: BEIGE, fontSize: 10, fontStyle: "bold" },
      styles: { font: "helvetica", fontSize: 9, textColor: CHARCOAL, cellPadding: 7 },
      head: [["Idea", "Category", "Scheduled", "Why"]],
      body: ideas.map((i) => [
        clip(i.title, 160),
        i.content_category ?? "—",
        fmtDate(i.scheduled_for),
        clip(i.campaign_rationale || i.funnel_rationale, 300),
      ]),
      columnStyles: {
        0: { cellWidth: 170, fontStyle: "bold" },
        1: { cellWidth: 80 },
        2: { cellWidth: 70 },
      },
    });
  }

  // ---------- Recommended action steps ----------
  doc.addPage();
  doc.setFillColor(BEIGE);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(CHARCOAL);
  doc.text("Recommended action steps", margin, margin + 10);
  doc.setDrawColor(accent);
  doc.setLineWidth(1.5);
  doc.line(margin, margin + 18, margin + 60, margin + 18);

  const actions = buildRecommendedActions(competitor, signals);
  let ay = margin + 44;
  for (const a of actions) {
    if (ay > pageH - 120) {
      doc.addPage();
      doc.setFillColor(BEIGE);
      doc.rect(0, 0, pageW, pageH, "F");
      ay = margin;
    }
    doc.setFillColor("#FFFFFF");
    const boxH = 40 + a.steps.length * 30;
    doc.roundedRect(margin, ay, pageW - margin * 2, boxH, 10, 10, "F");
    doc.setFillColor(accent);
    doc.rect(margin, ay, 4, boxH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(CHARCOAL);
    doc.text(a.title, margin + 16, ay + 22);

    let sy = ay + 40;
    a.steps.forEach((step, idx) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(accent);
      doc.text(`${idx + 1}.`, margin + 16, sy + 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(CHARCOAL);
      const lines = doc.splitTextToSize(step, pageW - margin * 2 - 44);
      doc.text(lines, margin + 32, sy + 10);
      sy += Math.max(24, lines.length * 12 + 8);
    });

    ay += boxH + 16;
  }

  // ---------- Sources & citations ----------
  if (orderedCitations.length > 0) {
    doc.addPage();
    doc.setFillColor(BEIGE);
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(CHARCOAL);
    doc.text("Sources & citations", margin, margin + 10);
    doc.setDrawColor(accent);
    doc.setLineWidth(1.5);
    doc.line(margin, margin + 18, margin + 60, margin + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    doc.text(
      "Numbered references from the signals table. Each URL was observed in this competitor's public surface at scan time — click to verify.",
      margin,
      margin + 40,
      { maxWidth: pageW - margin * 2 },
    );

    let cy = margin + 72;
    orderedCitations.forEach((c, i) => {
      if (cy > pageH - 60) {
        doc.addPage();
        doc.setFillColor(BEIGE);
        doc.rect(0, 0, pageW, pageH, "F");
        cy = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(accent);
      doc.text(`[${i + 1}]`, margin, cy);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(CHARCOAL);
      const channelLabel =
        c.channel === "instagram" ? "Instagram" : c.channel === "site" ? "Website" : "Web";
      doc.text(`${channelLabel} · ${c.label}`, margin + 30, cy);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor("#1E5AE8");
      const urlLines = doc.splitTextToSize(c.url, pageW - margin * 2 - 30);
      doc.textWithLink(urlLines[0], margin + 30, cy + 14, { url: c.url });
      if (urlLines.length > 1) {
        // Draw remaining lines as plain wrapped text so no clip.
        doc.text(urlLines.slice(1), margin + 30, cy + 26);
      }
      doc.setTextColor(CHARCOAL);

      cy += 22 + urlLines.length * 12;
    });
  }


  // Footer on all pages
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text(
      `Generated by Brandie · trybrandie.com · ${brand.name || ""}`,
      margin,
      pageH - 20,
    );
    doc.text(`${p} / ${total}`, pageW - margin, pageH - 20, { align: "right" });
  }

  return doc;
}
