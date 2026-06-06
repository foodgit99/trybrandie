// Client-side holiday calendar utility (mirrors the shared edge function version)

export interface Holiday {
  month: number;
  day: number;
  name: string;
  region: string;
  content_type: string;
}

const HOLIDAYS: Holiday[] = [
  // Global
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
  { month: 5, day: 11, name: "Mother's Day (US)", region: "US", content_type: "engagement" },
  { month: 6, day: 15, name: "Father's Day (US)", region: "US", content_type: "engagement" },
  { month: 7, day: 4, name: "Independence Day (US)", region: "US", content_type: "promotional" },
  { month: 10, day: 31, name: "Halloween", region: "US", content_type: "engagement" },
  { month: 11, day: 28, name: "Black Friday", region: "US", content_type: "promotional" },
  // UK
  { month: 3, day: 30, name: "Mother's Day (UK)", region: "UK", content_type: "engagement" },
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
  { month: 10, day: 20, name: "Diwali (approx.)", region: "IN", content_type: "engagement" },
  { month: 3, day: 14, name: "Holi (approx.)", region: "IN", content_type: "engagement" },
  // Islamic (approximate)
  { month: 3, day: 31, name: "Eid al-Fitr (approx.)", region: "global", content_type: "engagement" },
  { month: 6, day: 7, name: "Eid al-Adha (approx.)", region: "global", content_type: "engagement" },
  // Chinese/Lunar
  { month: 1, day: 29, name: "Lunar New Year (approx.)", region: "global", content_type: "engagement" },
  // Business
  { month: 4, day: 16, name: "National Entrepreneur Day", region: "global", content_type: "inspirational" },
  { month: 11, day: 26, name: "Small Business Saturday", region: "US", content_type: "promotional" },
];

export interface UpcomingHoliday extends Holiday {
  date: Date;
  daysUntil: number;
}

export function getUpcomingHolidays(days: number = 14): UpcomingHoliday[] {
  const now = new Date();
  const year = now.getFullYear();
  const results: UpcomingHoliday[] = [];

  for (const h of HOLIDAYS) {
    for (const y of [year, year + 1]) {
      const hDate = new Date(y, h.month, 1, h.day);
      const diff = (hDate.getTime(), now.getTime()) / (1000 * 60 * 60 * 24);
      if (diff >= -0.5 && diff <= days) {
        results.push({ ...h, date: hDate, daysUntil: Math.ceil(diff) });
      }
    }
  }

  results.sort((a, b) => a.date.getTime(), b.date.getTime());
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
