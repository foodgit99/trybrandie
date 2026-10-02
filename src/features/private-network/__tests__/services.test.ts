import { describe, it, expect } from "vitest";
import { profileCompleteness, parseList, formatNgn } from "../services/profile";
import { redirectUrl, shareText, whatsappUrl, nativeShare, canShareFiles, fileNameFor } from "../services/share";
import { pnError } from "../api";

describe("profile", () => {
  it("completeness counts required fields only", () => {
    expect(profileCompleteness(null).percent).toBe(0);
    const full = { display_name: "A", occupation: "B", location_country: "NG", age_bracket: "25-34", languages: ["en"], interests: ["x"], communities: ["y"],
      industries: ["z"], platforms: ["instagram"], audience_size_estimate: 0, audience_geographies: ["Lagos"], audience_age_brackets: ["25-34"] };
    expect(profileCompleteness(full as any).percent).toBe(100);
    expect(profileCompleteness({ ...full, languages: [] } as any).missing).toEqual(["languages"]);
  });
  it("parseList trims, dedupes, caps", () => {
    expect(parseList(" a, b ,,A, c")).toEqual(["a", "b", "c"]);
    expect(parseList(Array.from({ length: 30 }, (_, i) => `x${i}`).join(","), 5)).toHaveLength(5);
  });
  it("formats naira", () => expect(formatNgn(1500)).toBe("₦1,500"));
});

describe("share", () => {
  it("builds redirect link from token only", () => {
    expect(redirectUrl("pnabc", "https://x.supabase.co")).toBe("https://x.supabase.co/functions/v1/private-network-redirect?t=pnabc");
  });
  it("caption + link text and WhatsApp deep link", () => {
    expect(shareText("Hi", "L")).toBe("Hi\n\nL");
    expect(shareText(null, "L")).toBe("L");
    expect(whatsappUrl("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
  });
  it("native share outcomes are honest", async () => {
    expect(await nativeShare(undefined, { file: null, text: "t" })).toBe("unsupported");
    expect(await nativeShare({ share: async () => {} }, { file: null, text: "t" })).toBe("shared");
    const abort = Object.assign(new Error("x"), { name: "AbortError" });
    expect(await nativeShare({ share: async () => { throw abort; } }, { file: null, text: "t" })).toBe("cancelled");
    expect(await nativeShare({ share: async () => { throw new Error("boom"); } }, { file: null, text: "t" })).toBe("failed");
  });
  it("file share only when canShare accepts files", () => {
    const f = new File(["x"], "a.jpg", { type: "image/jpeg" });
    expect(canShareFiles({ share: async () => {}, canShare: () => true }, f)).toBe(true);
    expect(canShareFiles({ share: async () => {}, canShare: () => false }, f)).toBe(false);
    expect(canShareFiles({ share: async () => {} }, f)).toBe(false);
    expect(fileNameFor("PNC-0001", "video", "video/mp4")).toBe("pnc-0001.mp4");
  });
});

describe("errors", () => {
  it("strips server prefix", () => {
    expect(pnError({ message: "PN: Campaign budget is used up." })).toBe("Campaign budget is used up.");
    expect(pnError({ message: "new row violates row-level security policy" })).toMatch(/permission/);
  });
});
