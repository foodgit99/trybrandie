// Shared holiday calendar utility for all Brandie edge functions
// Provides structured holiday data and seasonal context helpers.
//
// IMPORTANT: Floating, lunar, and observance holidays (Eid, Diwali, Holi,
// Lunar New Year, Mid-Autumn, Mother's/Father's Day, Thanksgiving, Black
// Friday, Cyber Monday, MLK Day, Presidents' Day, Labor Day, UK Mothering
// Sunday) MUST use the `dates` map below. The static `month`/`day` is only
// used as a fallback label when no entry exists for the year — entries
// without a year mapping are SKIPPED so we never publish (e.g.) Eid on the
// wrong day. Update the per-year tables at the end of each calendar year.

export interface Holiday {
  month: number;
  day: number;
  name: string;
  region: string;
  content_type: string;
  /** Per-year exact dates (YYYY -> "MM-DD"). If present, only these years
   *  are considered "real" — other years are ignored entirely. */
  dates?: Record<number, string>;
}

// Per-year exact dates for floating / lunar / observance holidays.
// Add new years here as they become known. Without an entry, the holiday
// will be silently skipped for that year (intentional — better than wrong).
const EID_FITR:   Record<number, string> = { 2025: "03-30", 2026: "03-20", 2027: "03-09", 2028: "02-26" };
const EID_ADHA:   Record<number, string> = { 2025: "06-06", 2026: "05-27", 2027: "05-17", 2028: "05-05" };
const DIWALI:     Record<number, string> = { 2025: "10-20", 2026: "11-08", 2027: "10-29", 2028: "10-17" };
const HOLI:       Record<number, string> = { 2025: "03-14", 2026: "03-04", 2027: "03-22", 2028: "03-11" };
const LUNAR_NY:   Record<number, string> = { 2025: "01-29", 2026: "02-17", 2027: "02-06", 2028: "01-26" };
const MID_AUTUMN: Record<number, string> = { 2025: "10-06", 2026: "09-25", 2027: "09-15", 2028: "10-03" };
const MOTHERS_US: Record<number, string> = { 2025: "05-11", 2026: "05-10", 2027: "05-09", 2028: "05-14" };
const FATHERS_US: Record<number, string> = { 2025: "06-15", 2026: "06-21", 2027: "06-20", 2028: "06-18" }; // 3rd Sun Jun (also UK)
const MOTHERS_UK: Record<number, string> = { 2025: "03-30", 2026: "03-15", 2027: "03-07", 2028: "03-26" }; // Mothering Sunday
const THANKSGIVING_US: Record<number, string> = { 2025: "11-27", 2026: "11-26", 2027: "11-25", 2028: "11-23" };
const BLACK_FRIDAY:    Record<number, string> = { 2025: "11-28", 2026: "11-27", 2027: "11-26", 2028: "11-24" };
const CYBER_MONDAY:    Record<number, string> = { 2025: "12-01", 2026: "11-30", 2027: "11-29", 2028: "11-27" };
const SMALL_BIZ_SAT:   Record<number, string> = { 2025: "11-29", 2026: "11-28", 2027: "11-27", 2028: "11-25" };
const MLK_DAY:         Record<number, string> = { 2025: "01-20", 2026: "01-19", 2027: "01-18", 2028: "01-17" };
const PRESIDENTS_DAY:  Record<number, string> = { 2025: "02-17", 2026: "02-16", 2027: "02-15", 2028: "02-21" };
const LABOR_DAY_US:    Record<number, string> = { 2025: "09-01", 2026: "09-07", 2027: "09-06", 2028: "09-04" };

export const HOLIDAYS: Holiday[] = [
  // Global (fixed)
  { month: 1, day: 1, name: "New Year's Day", region: "global", content_type: "inspirational" },
  { month: 2, day: 14, name: "Valentine's Day", region: "global", content_type: "engagement" },
  { month: 3, day: 8, name: "International Women's Day", region: "global", content_type: "inspirational" },
  { month: 3, day: 20, name: "International Day of Happiness", region: "global", content_type: "engagement" },
  { month: 3, day: 21, name: "World Poetry Day", region: "global", content_type: "engagement" },
  { month: 4, day: 7, name: "World Health Day", region: "global", content_type: "engagement" },
  { month: 4, day: 22, name: "Earth Day", region: "global", content_type: "engagement" },
  { month: 5, day: 1, name: "International Workers' Day", region: "global", content_type: "inspirational" },
  { month: 5, day: 4, name: "Star Wars Day", region: "global", content_type: "engagement" },
  { month: 6, day: 1, name: "Pride Month Begins", region: "global", content_type: "engagement" },
  { month: 6, day: 5, name: "World Environment Day", region: "global", content_type: "engagement" },
  { month: 5, day: 31, name: "World No Tobacco Day", region: "global", content_type: "inspirational" },
  { month: 6, day: 19, name: "World Sickle Cell Day", region: "global", content_type: "inspirational" },
  { month: 6, day: 20, name: "World Refugee Day", region: "global", content_type: "inspirational" },
  { month: 6, day: 21, name: "International Day of Yoga", region: "global", content_type: "engagement" },
  { month: 6, day: 30, name: "Social Media Day", region: "global", content_type: "engagement" },
  { month: 7, day: 11, name: "World Population Day", region: "global", content_type: "inspirational" },
  { month: 7, day: 17, name: "World Emoji Day", region: "global", content_type: "engagement" },
  { month: 7, day: 30, name: "International Friendship Day", region: "global", content_type: "engagement" },
  { month: 8, day: 8, name: "International Cat Day", region: "global", content_type: "engagement" },
  { month: 8, day: 12, name: "International Youth Day", region: "global", content_type: "engagement" },
  { month: 8, day: 19, name: "World Photography Day", region: "global", content_type: "engagement" },
  { month: 9, day: 8, name: "International Literacy Day", region: "global", content_type: "inspirational" },
  { month: 9, day: 21, name: "International Day of Peace", region: "global", content_type: "inspirational" },
  { month: 10, day: 1, name: "World Coffee Day", region: "global", content_type: "engagement" },
  { month: 10, day: 5, name: "World Teachers' Day", region: "global", content_type: "inspirational" },
  { month: 10, day: 10, name: "World Mental Health Day", region: "global", content_type: "inspirational" },
  { month: 10, day: 16, name: "World Food Day", region: "global", content_type: "inspirational" },
  { month: 11, day: 13, name: "World Kindness Day", region: "global", content_type: "inspirational" },
  { month: 11, day: 14, name: "World Diabetes Day", region: "global", content_type: "inspirational" },
  { month: 11, day: 19, name: "International Men's Day", region: "global", content_type: "engagement" },
  { month: 12, day: 1, name: "World AIDS Day", region: "global", content_type: "inspirational" },
  { month: 12, day: 3, name: "International Day of Persons with Disabilities", region: "global", content_type: "inspirational" },
  { month: 12, day: 10, name: "Human Rights Day", region: "global", content_type: "inspirational" },
  { month: 12, day: 25, name: "Christmas Day", region: "global", content_type: "promotional" },
  { month: 12, day: 31, name: "New Year's Eve", region: "global", content_type: "engagement" },

  // US (floating)
  { month: 1, day: 1,  name: "Martin Luther King Jr. Day", region: "US", content_type: "inspirational", dates: MLK_DAY },
  { month: 2, day: 1,  name: "Presidents' Day", region: "US", content_type: "engagement", dates: PRESIDENTS_DAY },
  { month: 5, day: 1,  name: "Mother's Day (US)", region: "US", content_type: "engagement", dates: MOTHERS_US },
  { month: 6, day: 1,  name: "Father's Day (US)", region: "US", content_type: "engagement", dates: FATHERS_US },
  { month: 7, day: 4,  name: "Independence Day (US)", region: "US", content_type: "promotional" },
  { month: 9, day: 1,  name: "Labor Day (US)", region: "US", content_type: "engagement", dates: LABOR_DAY_US },
  { month: 10, day: 31, name: "Halloween", region: "US", content_type: "engagement" },
  { month: 11, day: 1, name: "Thanksgiving (US)", region: "US", content_type: "promotional", dates: THANKSGIVING_US },
  { month: 11, day: 1, name: "Black Friday", region: "US", content_type: "promotional", dates: BLACK_FRIDAY },
  { month: 11, day: 1, name: "Small Business Saturday", region: "US", content_type: "promotional", dates: SMALL_BIZ_SAT },
  { month: 12, day: 1, name: "Cyber Monday", region: "US", content_type: "promotional", dates: CYBER_MONDAY },

  // UK
  { month: 3, day: 1, name: "Mother's Day (UK)", region: "UK", content_type: "engagement", dates: MOTHERS_UK },
  { month: 4, day: 23, name: "St George's Day", region: "UK", content_type: "engagement" },
  { month: 6, day: 1, name: "Father's Day (UK)", region: "UK", content_type: "engagement", dates: FATHERS_US },
  { month: 11, day: 5, name: "Bonfire Night", region: "UK", content_type: "engagement" },
  { month: 12, day: 26, name: "Boxing Day", region: "UK", content_type: "promotional" },

  // Nigeria
  { month: 6, day: 12, name: "Democracy Day (Nigeria)", region: "NG", content_type: "inspirational" },
  { month: 10, day: 1, name: "Independence Day (Nigeria)", region: "NG", content_type: "inspirational" },

  // South Africa
  { month: 3, day: 21, name: "Human Rights Day (SA)", region: "ZA", content_type: "inspirational" },
  { month: 4, day: 27, name: "Freedom Day (SA)", region: "ZA", content_type: "inspirational" },
  { month: 6, day: 16, name: "Youth Day (SA)", region: "ZA", content_type: "inspirational" },
  { month: 9, day: 24, name: "Heritage Day (SA)", region: "ZA", content_type: "engagement" },

  // India
  { month: 1, day: 26, name: "Republic Day (India)", region: "IN", content_type: "inspirational" },
  { month: 8, day: 15, name: "Independence Day (India)", region: "IN", content_type: "inspirational" },
  { month: 10, day: 1, name: "Diwali", region: "IN", content_type: "engagement", dates: DIWALI },
  { month: 3, day: 1,  name: "Holi", region: "IN", content_type: "engagement", dates: HOLI },

  // Islamic (lunar — exact dates per year only)
  { month: 3, day: 1, name: "Eid al-Fitr", region: "global", content_type: "engagement", dates: EID_FITR },
  { month: 6, day: 1, name: "Eid al-Adha", region: "global", content_type: "engagement", dates: EID_ADHA },

  // Chinese/Lunar
  { month: 1, day: 1, name: "Lunar New Year", region: "global", content_type: "engagement", dates: LUNAR_NY },
  { month: 9, day: 1, name: "Mid-Autumn Festival", region: "global", content_type: "engagement", dates: MID_AUTUMN },

  // Business / Entrepreneurship
  { month: 4, day: 16, name: "National Entrepreneur Day", region: "global", content_type: "inspirational" },
];

/** Resolve the actual Date for a holiday in a specific year, or null if
 *  the holiday is floating/lunar and we don't have an entry for that year. */
function resolveHolidayDate(h: Holiday, year: number): Date | null {
  if (h.dates) {
    const md = h.dates[year];
    if (!md) return null; // skip — better than wrong
    const [m, d] = md.split("-").map(Number);
    return new Date(year, m - 1, d);
  }
  return new Date(year, h.month - 1, h.day);
}

/**
 * Returns holidays falling within the next N days from today.
 */
export function getUpcomingHolidays(days: number = 14): (Holiday & { date: Date; daysUntil: number })[] {
  const now = new Date();
  const year = now.getFullYear();
  const results: (Holiday & { date: Date; daysUntil: number })[] = [];

  for (const h of HOLIDAYS) {
    for (const y of [year, year + 1]) {
      const hDate = resolveHolidayDate(h, y);
      if (!hDate) continue;
      const diff = (hDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (diff >= -0.5 && diff <= days) {
        results.push({ ...h, date: hDate, daysUntil: Math.ceil(diff) });
      }
    }
  }

  results.sort((a, b) => a.date.getTime() - b.date.getTime());
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.name}-${r.date.toISOString().split("T")[0]}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Returns holidays falling within a specific week (given Monday date).
 */
export function getWeekHolidays(monday: Date): Holiday[] {
  const weekStart = new Date(monday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const year = weekStart.getFullYear();
  return HOLIDAYS.filter((h) => {
    // Check both this year and next (week spanning Dec->Jan)
    for (const y of [year, year + 1]) {
      const hDate = resolveHolidayDate(h, y);
      if (hDate && hDate >= weekStart && hDate <= weekEnd) return true;
    }
    return false;
  });
}

/**
 * Returns the current season for the Northern Hemisphere.
 */
export function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Autumn";
  return "Winter";
}

/**
 * Generates a date + seasonal context string for injection into AI system prompts.
 */
export function getSeasonalContextString(daysAhead: number = 14): string {
  const now = new Date();
  const season = getCurrentSeason();
  const upcoming = getUpcomingHolidays(daysAhead);

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let ctx = `\n## Current Date & Seasonal Context\n- **Today**: ${dateStr}\n- **Season**: ${season}\n`;

  if (upcoming.length > 0) {
    ctx += `- **Upcoming Events (next ${daysAhead} days)**:\n`;
    for (const h of upcoming) {
      const dateLabel = h.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const urgency = h.daysUntil <= 0 ? "TODAY" : h.daysUntil === 1 ? "TOMORROW" : `in ${h.daysUntil} days`;
      ctx += `  - ${h.name} — ${dateLabel} (${urgency}) [${h.content_type}]\n`;
    }
  } else {
    ctx += `- No major events in the next ${daysAhead} days.\n`;
  }

  return ctx;
}
