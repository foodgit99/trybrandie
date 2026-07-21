import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Brandie palette
const BEIGE = "#FAF8F5";
const CHARCOAL = "#2B2D33";
const GOLD = "#C4993B";
const MUTED = "#6B6B6B";

export type PdfCompetitor = {
  id: string;
  name: string;
  domain: string | null;
  instagram_handle: string | null;
  logo_url: string | null;
  discovery_source: "auto" | "user";
  discovery_rationale: string | null;
  last_scanned_at: string | null;
};

export type PdfSignal = {
  id: string;
  competitor_id: string;
  signal_type: string;
  summary: string;
  rationale: string | null;
  content_idea_id: string | null;
  week_start_date: string;
};

export type PdfIdea = {
  id: string;
  title: string;
  content_category: string | null;
  scheduled_for: string | null;
  campaign_rationale?: string | null;
  funnel_rationale?: string | null;
};

export type PdfBrand = { name: string; logo_url?: string | null };

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

export async function buildCompetitorDigestPdf(args: {
  brand: PdfBrand;
  competitors: PdfCompetitor[];
  signals: PdfSignal[];
  ideas: PdfIdea[];
}): Promise<jsPDF> {
  const { brand, competitors, signals, ideas } = args;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // ---------- Cover ----------
  doc.setFillColor(BEIGE);
  doc.rect(0, 0, pageW, pageH, "F");

  // Brand logo (optional)
  let cursorY = margin + 20;
  if (brand.logo_url) {
    const data = await fetchImageDataUrl(brand.logo_url);
    if (data) {
      try {
        doc.addImage(data, "PNG", margin, cursorY, 56, 56);
      } catch {}
    }
  }
  cursorY += 80;

  doc.setTextColor(CHARCOAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("Competitor Digest", margin, cursorY);

  cursorY += 32;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(MUTED);
  doc.text(brand.name || "Your brand", margin, cursorY);

  cursorY += 20;
  doc.setFontSize(11);
  doc.text(
    `Report date: ${new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    margin,
    cursorY,
  );

  // Gold rule
  cursorY += 24;
  doc.setDrawColor(GOLD);
  doc.setLineWidth(2);
  doc.line(margin, cursorY, margin + 80, cursorY);

  // Executive summary
  cursorY += 40;
  doc.setTextColor(CHARCOAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("This week at a glance", margin, cursorY);

  const stats = [
    ["Competitors tracked", String(competitors.length)],
    ["Signals surfaced", String(signals.length)],
    ["Content ideas generated", String(ideas.length)],
  ];
  autoTable(doc, {
    startY: cursorY + 10,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { font: "helvetica", fontSize: 11, textColor: CHARCOAL, cellPadding: 6 },
    columnStyles: {
      0: { textColor: MUTED, cellWidth: 200 },
      1: { fontStyle: "bold", textColor: CHARCOAL },
    },
    body: stats,
  });

  // ---------- Competitors ----------
  doc.addPage();
  doc.setFillColor(BEIGE);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(CHARCOAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Competitors", margin, margin + 10);
  doc.setDrawColor(GOLD);
  doc.setLineWidth(1.5);
  doc.line(margin, margin + 18, margin + 60, margin + 18);

  const signalsByCompetitor = new Map<string, PdfSignal[]>();
  for (const s of signals) {
    const arr = signalsByCompetitor.get(s.competitor_id) ?? [];
    arr.push(s);
    signalsByCompetitor.set(s.competitor_id, arr);
  }

  let y = margin + 40;
  for (const c of competitors) {
    // page break check
    if (y > pageH - 160) {
      doc.addPage();
      doc.setFillColor(BEIGE);
      doc.rect(0, 0, pageW, pageH, "F");
      y = margin;
    }

    // logo
    let textX = margin;
    if (c.logo_url) {
      const data = await fetchImageDataUrl(c.logo_url);
      if (data) {
        try {
          doc.addImage(data, "PNG", margin, y, 32, 32);
          textX = margin + 44;
        } catch {}
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(CHARCOAL);
    doc.text(c.name, textX, y + 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    const meta = [
      c.domain ?? null,
      c.instagram_handle ? `@${c.instagram_handle.replace(/^@/, "")}` : null,
      `Scanned ${fmtDate(c.last_scanned_at)}`,
      c.discovery_source === "auto" ? "Auto-discovered" : "Added by you",
    ]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(meta, textX, y + 28);

    y += 44;

    if (c.discovery_rationale) {
      doc.setFontSize(10);
      doc.setTextColor(CHARCOAL);
      const lines = doc.splitTextToSize(clip(c.discovery_rationale, 300), pageW - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 12 + 4;
    }

    const cs = signalsByCompetitor.get(c.id) ?? [];
    if (cs.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: "grid",
        headStyles: {
          fillColor: CHARCOAL,
          textColor: BEIGE,
          fontSize: 9,
          fontStyle: "bold",
        },
        styles: { font: "helvetica", fontSize: 9, textColor: CHARCOAL, cellPadding: 6 },
        head: [["Signal", "What they did", "Why it matters"]],
        body: cs.map((s) => [
          SIGNAL_LABELS[s.signal_type] ?? s.signal_type,
          clip(s.summary, 240),
          clip(s.rationale, 240),
        ]),
        columnStyles: {
          0: { cellWidth: 90, fontStyle: "bold", textColor: GOLD },
          1: { cellWidth: 200 },
        },
      });
      // @ts-expect-error autotable augments
      y = (doc.lastAutoTable?.finalY ?? y) + 24;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(MUTED);
      doc.text("No signals this week.", margin, y);
      y += 24;
    }
  }

  // ---------- What to steal ----------
  doc.addPage();
  doc.setFillColor(BEIGE);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(CHARCOAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("What to steal this week", margin, margin + 10);
  doc.setDrawColor(GOLD);
  doc.setLineWidth(1.5);
  doc.line(margin, margin + 18, margin + 60, margin + 18);

  if (ideas.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(MUTED);
    doc.text(
      "Ideas will appear here after your next digest run.",
      margin,
      margin + 50,
    );
  } else {
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

  // Footer on all pages
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text("Generated by Brandie · trybrandie.com", margin, pageH - 20);
    doc.text(`${p} / ${total}`, pageW - margin, pageH - 20, { align: "right" });
  }

  return doc;
}
