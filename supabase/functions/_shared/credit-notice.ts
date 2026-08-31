// Credit-notice throttle — the "credits running low" / "out of credits" emails
// must be sent ONCE per top-up cycle, never daily. The only recurring daily
// email is the autopilot "your post is ready" delivery.
//
// `profiles.low_credits_notified_at` is stamped when a notice goes out and is
// cleared automatically by DB triggers whenever credits are added (payment,
// bonus, reward grant, monthly refresh), which re-arms a single new notice.

// deno-lint-ignore no-explicit-any
type Client = any;

/**
 * Atomically claims the right to send one credit notice for this user.
 * Returns true only for the first caller after the latest top-up.
 */
export async function claimCreditNotice(client: Client, userId: string): Promise<boolean> {
  try {
    const { data, error } = await client
      .from("profiles")
      .update({ low_credits_notified_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("low_credits_notified_at", null)
      .select("user_id");
    if (error) {
      console.error("[credit-notice] claim failed:", error.message);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (e) {
    console.error("[credit-notice] claim error:", e);
    return false;
  }
}
