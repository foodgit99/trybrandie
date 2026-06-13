// Client-side holiday calendar utility.
// PREFERRED: use `fetchUpcomingHolidaysLive` which calls the `holiday-feed`
// edge function (Firecrawl-sourced, weekly-cached, brand-region aware).
// The hardcoded `getUpcomingHolidays` is kept ONLY as a synchronous
// fallback for initial render and offline scenarios.

import { supabase } from "@/integrations/supabase/client";


export interface Holiday {
  month: number;
  day: number;
  name: string;
  region: string;
  content_type: string;
  dates?: Record<number, string>;
}

const EID_FITR:   Record<number, string> = { 2025: "03-30", 2026: "03-20", 2027: "03-09", 2028: "02-26" };
const EID_ADHA:   Record<number, string> = { 2025: "06-06", 2026: "05-27", 2027: "05-17", 2028: "05-05" };
const DIWALI:     Record<number, string> = { 2025: "10-20", 2026: "11-08", 2027: "10-29", 2028: "10-17" };
const HOLI:       Record<number, string> = { 2025: "03-14", 2026: "03-04", 2027: "03-22", 2028: "03-11" };
const LUNAR_NY:   Record<number, string> = { 2025: "01-29", 2026: "02-17", 2027: "02-06", 2028: "01-26" };
const MOTHERS_US: Record<number, string> = { 2025: "05-11", 2026: "05-10", 2027: "05-09", 2028: "05-14" };
const FATHERS_US: Record<number, string> = { 2025: "06-15", 2026: "06-21", 2027: "06-20", 2028: "06-18" };
const MOTHERS_UK: Record<number, string> = { 2025: "03-30", 2026: "03-15", 2027: "03-07", 2028: "03-26" };
const THANKSGIVING_US: Record<number, string> = { 2025: "11-27", 2026: "11-26", 2027: "11-25", 2028: "11-23" };
const BLACK_FRIDAY:    Record<number, string> = { 2025: "11-28", 2026: "11-27", 2027: "11-26", 2028: "11-24" };
const SMALL_BIZ_SAT:   Record<number, string> = { 2025: "11-29", 2026: "11-28", 2027: "11-27", 2028: "11-25" };

const HOLIDAYS: Holiday[] = [
  { month: 1, day: 1, name: "New Year's Day", region: "global", content_type: "inspirational" },
  { month: 2, day: 14, name: "Valentine's Day", region: "global", content_type: "engagement" },
  { month: 3, day: 8, name: "International Women's Day", region: "global", content_type: "inspirational" },
  { month: 3, day: 20, name: "International Day of Happiness", region: "global", content_type: "engagement" },
  { month: 4, day: 7, name: "World Health Day", region: "global", content_type: "engagement" },
  { month: 4, day: 22, name: "Earth Day", region: "global", content_type: "engagement" },
  { month: 5, day: 1, name: "International Workers' Day", region: "global", content_type: "inspirational" },
  { month: 5, day: 4, name: "Star Wars Day", region: "global", content_type: "engagement" },
  { month: 6, day: 1, name: "Pride Month Begins", region: "global", content_type: "engagement" },
  { month: 6, day: 5, name: "World Environment Day", region: "global", content_type: "engagement" },
  { month: 6, day: 30, name: "Social Media Day", region: "global", content_type: "engagement" },
  { month: 7, day: 17, name: "World Emoji Day", region: "global", content_type: "engagement" },
  { month: 8, day: 12, name: "International Youth Day", region: "global", content_type: "engagement" },
  { month: 8, day: 19, name: "World Photography Day", region: "global", content_type: "engagement" },
  { month: 9, day: 21, name: "International Day of Peace", region: "global", content_type: "inspirational" },
  { month: 10, day: 10, name: "World Mental Health Day", region: "global", content_type: "inspirational" },
  { month: 11, day: 13, name: "World Kindness Day", region: "global", content_type: "inspirational" },
  { month: 12, day: 25, name: "Christmas Day", region: "global", content_type: "promotional" },
  { month: 12, day: 31, name: "New Year's Eve", region: "global", content_type: "engagement" },
  // US
  { month: 5, day: 1, name: "Mother's Day (US)", region: "US", content_type: "engagement", dates: MOTHERS_US },
  { month: 6, day: 1, name: "Father's Day (US)", region: "US", content_type: "engagement", dates: FATHERS_US },
  { month: 7, day: 4, name: "Independence Day (US)", region: "US", content_type: "promotional" },
  { month: 10, day: 31, name: "Halloween", region: "US", content_type: "engagement" },
  { month: 11, day: 1, name: "Thanksgiving (US)", region: "US", content_type: "promotional", dates: THANKSGIVING_US },
  { month: 11, day: 1, name: "Black Friday", region: "US", content_type: "promotional", dates: BLACK_FRIDAY },
  { month: 11, day: 1, name: "Small Business Saturday", region: "US", content_type: "promotional", dates: SMALL_BIZ_SAT },
  // UK
  { month: 3, day: 1, name: "Mother's Day (UK)", region: "UK", content_type: "engagement", dates: MOTHERS_UK },
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
  // India / lunar
  { month: 10, day: 1, name: "Diwali", region: "IN", content_type: "engagement", dates: DIWALI },
  { month: 3, day: 1, name: "Holi", region: "IN", content_type: "engagement", dates: HOLI },
  // Islamic (lunar)
  { month: 3, day: 1, name: "Eid al-Fitr", region: "global", content_type: "engagement", dates: EID_FITR },
  { month: 6, day: 1, name: "Eid al-Adha", region: "global", content_type: "engagement", dates: EID_ADHA },
  // Chinese
  { month: 1, day: 1, name: "Lunar New Year", region: "global", content_type: "engagement", dates: LUNAR_NY },
  // Business
  { month: 4, day: 16, name: "National Entrepreneur Day", region: "global", content_type: "inspirational" },
];

export interface UpcomingHoliday extends Holiday {
  date: Date;
  daysUntil: number;
}

function resolveHolidayDate(h: Holiday, year: number): Date | null {
  if (h.dates) {
    const md = h.dates[year];
    if (!md) return null;
    const [m, d] = md.split("-").map(Number);
    return new Date(year, m - 1, d);
  }
  return new Date(year, h.month - 1, h.day);
}

export function getUpcomingHolidays(days: number = 14): UpcomingHoliday[] {
  const now = new Date();
  const year = now.getFullYear();
  const results: UpcomingHoliday[] = [];

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

export function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Autumn";
  return "Winter";
}
