// Pauses autopilot for brands whose owner hasn't signed in for DORMANT_DAYS+
// and notifies each owner by email. Safe to call on every autopilot tick:
// the SQL function only returns rows it actually flipped from enabled -> paused,
// so an owner is emailed once per pause event, not once per cron run.

export const DORMANT_DAYS = 15;

type DormantRow = {
  brand_id: string;
  user_id: string;
  brand_name: string | null;
  email: string | null;
  last_sign_in_at: string | null;
};

export async function pauseDormantBrands(
  supabase: any,
  supabaseUrl: string,
  serviceRoleKey: string,
  logPrefix = "[autopilot]",
): Promise<DormantRow[]> {
  try {
    const { data, error } = await supabase.rpc("pause_dormant_autopilot", { p_days: DORMANT_DAYS });
    if (error) {
      console.error(`${logPrefix} dormancy pause failed:`, error.message);
      return [];
    }
    const rows = (data || []) as DormantRow[];
    if (rows.length === 0) return [];

    console.log(`${logPrefix} paused ${rows.length} dormant brand(s)`);

    await Promise.all(
      rows.map(async (row) => {
        if (!row.email) return;
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              type: "autopilot_paused_dormant",
              to: row.email,
              data: {
                brand_id: row.brand_id,
                brand_name: row.brand_name || "your brand",
                days: DORMANT_DAYS,
                last_sign_in_at: row.last_sign_in_at,
              },
            }),
          });
          if (!res.ok) {
            console.error(`${logPrefix} dormancy email failed for ${row.brand_id}: ${res.status}`);
          }
        } catch (e) {
          console.error(`${logPrefix} dormancy email threw for ${row.brand_id}:`, e);
        }
      }),
    );

    return rows;
  } catch (e) {
    console.error(`${logPrefix} dormancy pause threw:`, e);
    return [];
  }
}
