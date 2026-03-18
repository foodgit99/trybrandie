import { useState, useRef, useCallback } from "react";
import { Download, FileText, FileSpreadsheet, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};
const DAY_SHORT: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

type ExportFormat = "pdf" | "csv" | "image";
type ViewMode = "strategy" | "execution";

interface CalendarExportProps {
  weeklyIdeas: any[] | undefined;
  brand: any;
  pillars: any[] | undefined;
  series: any[] | undefined;
  campaigns: any[] | undefined;
  weekLabel: string;
  selectedMonday: Date;
  selectedSunday: Date;
}

export default function CalendarExport({
  weeklyIdeas,
  brand,
  pillars,
  series,
  campaigns,
  weekLabel,
  selectedMonday,
  selectedSunday,
}: CalendarExportProps) {
  const { toast } = useToast();
  const [viewModeDialogOpen, setViewModeDialogOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const ideasByDay = (weeklyIdeas || []).reduce((acc: Record<string, any[]>, idea: any) => {
    if (!idea.scheduled_for) return acc;
    const d = new Date(idea.scheduled_for + "T00:00:00");
    const dayIndex = (d.getDay() + 6) % 7;
    const dayKey = DAYS[dayIndex];
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(idea);
    return acc;
  }, {});

  const getPillarName = (id: string) => pillars?.find((p: any) => p.id === id)?.name || "";
  const getSeriesName = (id: string) => series?.find((s: any) => s.id === id)?.name || "";
  const getCampaignName = (id: string) => campaigns?.find((c: any) => c.id === id)?.name || "";

  const brandColor = brand?.primary_colors?.[0] || "#6366f1";
  const dateRange = `${selectedMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${selectedSunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const handleFormatSelect = (format: ExportFormat) => {
    setPendingFormat(format);
    setViewModeDialogOpen(true);
  };

  const handleExport = async (viewMode: ViewMode) => {
    setViewModeDialogOpen(false);
    if (!pendingFormat) return;
    setExporting(true);
    try {
      switch (pendingFormat) {
        case "csv":
          exportCSV(viewMode);
          break;
        case "pdf":
          await exportPDF(viewMode);
          break;
        case "image":
          await exportImage(viewMode);
          break;
      }
      toast({ title: "Export complete", description: `Your ${pendingFormat.toUpperCase()} has been downloaded.` });
    } catch (e: any) {
      console.error("Export failed:", e);
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
      setPendingFormat(null);
    }
  };

  // ─── CSV ─────────────────────────────────────────────
  const exportCSV = (viewMode: ViewMode) => {
    const rows: string[][] = [];

    if (viewMode === "strategy") {
      rows.push(["Day", "Type", "Title"]);
      DAYS.forEach((day) => {
        const ideas = ideasByDay[day] || [];
        if (ideas.length === 0) {
          rows.push([DAY_LABELS[day], "—", "—"]);
        } else {
          ideas.forEach((idea: any, i: number) => {
            rows.push([
              i === 0 ? DAY_LABELS[day] : "",
              idea.idea_type === "series_post" ? "Series" : idea.idea_type === "campaign_post" ? "Campaign" : "Idea",
              idea.title,
            ]);
          });
        }
      });
    } else {
      rows.push(["Day", "Title", "Design Prompt", "Pillar", "Series", "Campaign", "Status"]);
      DAYS.forEach((day) => {
        const ideas = ideasByDay[day] || [];
        if (ideas.length === 0) {
          rows.push([DAY_LABELS[day], "—", "", "", "", "", ""]);
        } else {
          ideas.forEach((idea: any, i: number) => {
            rows.push([
              i === 0 ? DAY_LABELS[day] : "",
              idea.title,
              idea.prompt || "",
              getPillarName(idea.pillar_id),
              getSeriesName(idea.series_id),
              getCampaignName(idea.campaign_id),
              idea.status === "created" ? "Done" : "Pending",
            ]);
          });
        }
      });
    }

    const csvContent = rows.map((r) => r.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${brand?.name || "Brandie"}-content-plan-${viewMode}.csv`);
  };

  // ─── PDF ─────────────────────────────────────────────
  const exportPDF = async (viewMode: ViewMode) => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Parse hex color to RGB
    const hexToRgb = (hex: string) => {
      const h = hex.replace("#", "");
      return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16),
      };
    };
    const accent = hexToRgb(brandColor);

    // Header bar
    doc.setFillColor(accent.r, accent.g, accent.b);
    doc.rect(0, 0, pageWidth, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(brand?.name || "Content Plan", margin, 13);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(dateRange, pageWidth - margin, 13, { align: "right" });

    y = 28;

    // View mode label
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(viewMode === "strategy" ? "Strategy View" : "Execution View", margin, y);
    y += 6;

    // Table header
    doc.setFillColor(245, 245, 245);
    const headerHeight = 7;

    if (viewMode === "strategy") {
      const cols = [
        { label: "Day", x: margin, w: 25 },
        { label: "Type", x: margin + 25, w: 25 },
        { label: "Title", x: margin + 50, w: contentWidth - 50 },
      ];
      doc.rect(margin, y, contentWidth, headerHeight, "F");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      cols.forEach((c) => doc.text(c.label, c.x + 2, y + 5));
      y += headerHeight + 1;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      DAYS.forEach((day) => {
        const ideas = ideasByDay[day] || [];
        if (ideas.length === 0) {
          doc.text(DAY_SHORT[day], cols[0].x + 2, y + 4);
          doc.text("—", cols[1].x + 2, y + 4);
          doc.setDrawColor(230, 230, 230);
          doc.line(margin, y + 6, margin + contentWidth, y + 6);
          y += 7;
        } else {
          ideas.forEach((idea: any, i: number) => {
            if (y > 270) { doc.addPage(); y = margin; }
            if (i === 0) doc.text(DAY_SHORT[day], cols[0].x + 2, y + 4);
            const type = idea.idea_type === "series_post" ? "Series" : idea.idea_type === "campaign_post" ? "Campaign" : "Idea";
            doc.text(type, cols[1].x + 2, y + 4);
            doc.text(truncateText(idea.title, 70), cols[2].x + 2, y + 4);
            doc.setDrawColor(230, 230, 230);
            doc.line(margin, y + 6, margin + contentWidth, y + 6);
            y += 7;
          });
        }
      });
    } else {
      // Execution view
      const cols = [
        { label: "Day", x: margin, w: 18 },
        { label: "Title", x: margin + 18, w: 40 },
        { label: "Prompt", x: margin + 58, w: 55 },
        { label: "Pillar", x: margin + 113, w: 25 },
        { label: "Status", x: margin + 138, w: contentWidth - 138 },
      ];
      doc.rect(margin, y, contentWidth, headerHeight, "F");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      cols.forEach((c) => doc.text(c.label, c.x + 1, y + 5));
      y += headerHeight + 1;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(7);
      DAYS.forEach((day) => {
        const ideas = ideasByDay[day] || [];
        if (ideas.length === 0) {
          doc.text(DAY_SHORT[day], cols[0].x + 1, y + 4);
          doc.text("—", cols[1].x + 1, y + 4);
          doc.setDrawColor(230, 230, 230);
          doc.line(margin, y + 6, margin + contentWidth, y + 6);
          y += 7;
        } else {
          ideas.forEach((idea: any, i: number) => {
            if (y > 270) { doc.addPage(); y = margin; }
            if (i === 0) doc.text(DAY_SHORT[day], cols[0].x + 1, y + 4);
            doc.text(truncateText(idea.title, 30), cols[1].x + 1, y + 4);
            doc.text(truncateText(idea.prompt || "", 45), cols[2].x + 1, y + 4);
            doc.text(truncateText(getPillarName(idea.pillar_id), 18), cols[3].x + 1, y + 4);
            const status = idea.status === "created" ? "Done" : "Pending";
            doc.setTextColor(idea.status === "created" ? 34 : 150, idea.status === "created" ? 139 : 150, idea.status === "created" ? 34 : 150);
            doc.text(status, cols[4].x + 1, y + 4);
            doc.setTextColor(30, 30, 30);
            doc.setDrawColor(230, 230, 230);
            doc.line(margin, y + 6, margin + contentWidth, y + 6);
            y += 7;
          });
        }
      });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text("Planned with Brandie", pageWidth / 2, pageHeight - 8, { align: "center" });

    doc.save(`${brand?.name || "Brandie"}-content-plan-${viewMode}.pdf`);
  };

  // ─── IMAGE ───────────────────────────────────────────
  const exportImage = async (viewMode: ViewMode) => {
    const html2canvas = (await import("html2canvas")).default;

    // Build a temporary styled element
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;left:-9999px;top:0;width:800px;background:#fff;font-family:system-ui,-apple-system,sans-serif;padding:0;`;
    document.body.appendChild(container);

    const accentCSS = brandColor;
    const contrastText = isLightColor(brandColor) ? "#1a1a1a" : "#ffffff";

    container.innerHTML = `
      <div style="background:${accentCSS};padding:24px 32px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:16px;">
          ${brand?.logo_url ? `<img src="${brand.logo_url}" style="height:36px;width:36px;object-fit:contain;border-radius:6px;" crossorigin="anonymous" />` : ""}
          <div>
            <div style="color:${contrastText};font-size:20px;font-weight:700;">${brand?.name || "Content Plan"}</div>
            <div style="color:${contrastText};opacity:0.8;font-size:13px;">${dateRange} · ${viewMode === "strategy" ? "Strategy View" : "Execution View"}</div>
          </div>
        </div>
      </div>
      <div style="padding:24px 32px;">
        ${buildTableHTML(viewMode, ideasByDay, accentCSS)}
      </div>
      <div style="padding:16px 32px;text-align:center;border-top:1px solid #eee;">
        <span style="color:#bbb;font-size:11px;">Planned with Brandie</span>
      </div>
    `;

    // Wait for logo image to load
    await new Promise((r) => setTimeout(r, 300));

    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    document.body.removeChild(container);

    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${brand?.name || "Brandie"}-content-plan-${viewMode}.png`);
    }, "image/png");
  };

  const buildTableHTML = (viewMode: ViewMode, ideasByDay: Record<string, any[]>, accent: string) => {
    let html = `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;

    if (viewMode === "strategy") {
      html += `<tr style="background:#f7f7f7;">
        <th style="text-align:left;padding:8px 12px;font-weight:600;font-size:11px;color:#666;width:80px;">Day</th>
        <th style="text-align:left;padding:8px 12px;font-weight:600;font-size:11px;color:#666;width:80px;">Type</th>
        <th style="text-align:left;padding:8px 12px;font-weight:600;font-size:11px;color:#666;">Title</th>
      </tr>`;
      DAYS.forEach((day) => {
        const ideas = ideasByDay[day] || [];
        if (ideas.length === 0) {
          html += `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:10px 12px;font-weight:500;">${DAY_SHORT[day]}</td>
            <td style="padding:10px 12px;color:#ccc;">—</td>
            <td style="padding:10px 12px;color:#ccc;">—</td>
          </tr>`;
        } else {
          ideas.forEach((idea: any, i: number) => {
            const type = idea.idea_type === "series_post" ? "Series" : idea.idea_type === "campaign_post" ? "Campaign" : "Idea";
            const typeBg = idea.idea_type === "series_post" ? "#eef2ff" : idea.idea_type === "campaign_post" ? "#fef3c7" : "#f0fdf4";
            html += `<tr style="border-bottom:1px solid #eee;">
              <td style="padding:10px 12px;font-weight:500;">${i === 0 ? DAY_SHORT[day] : ""}</td>
              <td style="padding:10px 12px;"><span style="background:${typeBg};padding:2px 8px;border-radius:4px;font-size:11px;">${type}</span></td>
              <td style="padding:10px 12px;">${escapeHtml(idea.title)}</td>
            </tr>`;
          });
        }
      });
    } else {
      html += `<tr style="background:#f7f7f7;">
        <th style="text-align:left;padding:8px 10px;font-weight:600;font-size:11px;color:#666;width:60px;">Day</th>
        <th style="text-align:left;padding:8px 10px;font-weight:600;font-size:11px;color:#666;width:140px;">Title</th>
        <th style="text-align:left;padding:8px 10px;font-weight:600;font-size:11px;color:#666;">Prompt</th>
        <th style="text-align:left;padding:8px 10px;font-weight:600;font-size:11px;color:#666;width:80px;">Status</th>
      </tr>`;
      DAYS.forEach((day) => {
        const ideas = ideasByDay[day] || [];
        if (ideas.length === 0) {
          html += `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:10px;font-weight:500;">${DAY_SHORT[day]}</td>
            <td style="padding:10px;color:#ccc;">—</td>
            <td style="padding:10px;"></td>
            <td style="padding:10px;"></td>
          </tr>`;
        } else {
          ideas.forEach((idea: any, i: number) => {
            const statusColor = idea.status === "created" ? "#22c55e" : "#999";
            const statusLabel = idea.status === "created" ? "✓ Done" : "Pending";
            html += `<tr style="border-bottom:1px solid #eee;">
              <td style="padding:10px;font-weight:500;">${i === 0 ? DAY_SHORT[day] : ""}</td>
              <td style="padding:10px;font-weight:500;">${escapeHtml(idea.title)}</td>
              <td style="padding:10px;color:#555;font-size:12px;">${escapeHtml(truncateText(idea.prompt || "", 80))}</td>
              <td style="padding:10px;color:${statusColor};font-weight:500;font-size:12px;">${statusLabel}</td>
            </tr>`;
          });
        }
      });
    }

    html += `</table>`;
    return html;
  };

  // ─── Utils ───────────────────────────────────────────
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const truncateText = (text: string, max: number) =>
    text.length > max ? text.substring(0, max - 1) + "…" : text;

  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const isLightColor = (hex: string) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  };

  const hasIdeas = weeklyIdeas && weeklyIdeas.length > 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={!hasIdeas || exporting}
          >
            <Download className="h-3 w-3" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-xs">Export calendar</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleFormatSelect("pdf")} className="gap-2 text-xs">
            <FileText className="h-3.5 w-3.5" />
            PDF Document
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleFormatSelect("csv")} className="gap-2 text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            CSV Spreadsheet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleFormatSelect("image")} className="gap-2 text-xs">
            <Image className="h-3.5 w-3.5" />
            Image (PNG)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View Mode Selection Dialog */}
      <Dialog open={viewModeDialogOpen} onOpenChange={setViewModeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Choose export view</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-2">
            <button
              onClick={() => handleExport("strategy")}
              className="text-left p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors"
            >
              <div className="font-medium text-sm">Strategy View</div>
              <p className="text-xs text-muted-foreground mt-1">
                Compact overview — day, type, and title. Great for planning.
              </p>
            </button>
            <button
              onClick={() => handleExport("execution")}
              className="text-left p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors"
            >
              <div className="font-medium text-sm">Execution View</div>
              <p className="text-xs text-muted-foreground mt-1">
                Full details — prompts, pillars, status. Ready for doing.
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
