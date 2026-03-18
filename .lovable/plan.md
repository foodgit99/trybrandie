

## Multi-Format Calendar Export

### Overview
Add an export dropdown to the weekly calendar section header in ContentHub, supporting three formats: PDF, CSV, and Image (PNG). Both PDF and Image exports will be branded with the user's colors and logo, and include a "Planned with Brandie" footer. Two view modes: **Strategy View** (compact day-by-type) and **Execution View** (full details with prompt, status, series/campaign tags).

### Architecture

**New file: `src/components/CalendarExport.tsx`**
- A dropdown menu button (using existing `DropdownMenu` component) placed next to the "Generate Ideas" button in the weekly calendar header
- Export options: PDF, CSV, Image (PNG)
- Before exporting, opens a small dialog to choose between Strategy View and Execution View

**Export implementation (all client-side):**

1. **CSV Export** — Pure JS. Build a CSV string from `weeklyIdeas` data. Strategy view: `Day, Type, Title`. Execution view: `Day, Title, Prompt, Series, Campaign, Pillar, Status`. Trigger download via `Blob` + `URL.createObjectURL`.

2. **PDF Export** — Use `jspdf` library. Render a branded calendar layout:
   - Header: brand logo (if available) + brand name + week range
   - Body: table rows per day with ideas
   - Footer: "Planned with Brandie" + brandie logo
   - Use brand primary color for accents

3. **Image Export (PNG)** — Use a hidden HTML div rendered with brand styling, then capture with `html2canvas`. Same layout as PDF. Download as PNG.

**Dependencies to add:** `jspdf`, `html2canvas`

### Component Integration
- `CalendarExport` receives: `weeklyIdeas`, `brand`, `pillars`, `series`, `campaigns`, `weekLabel`, `selectedMonday`, `selectedSunday`
- Placed in the calendar section header alongside existing navigation and generate buttons

### Branded Styling
- Use `brand.primary_colors[0]` as accent color for headers/borders
- Display `brand.logo_url` in header if available
- Brand name from `brand.name`
- Footer: "Planned with Brandie" with subtle styling

### Files Changed
1. **`src/components/CalendarExport.tsx`** (new) — Export dropdown + view mode dialog + all three export functions
2. **`src/pages/ContentHub.tsx`** — Import and render `CalendarExport` in the calendar section header
3. **`package.json`** — Add `jspdf` and `html2canvas` dependencies

