/** Computed lead statuses shared by the partner CRM, campaigns and automations. */
export const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "activated", label: "Activated" },
  { value: "active", label: "Active" },
  { value: "low_credits", label: "Low credits" },
  { value: "exhausted", label: "Exhausted" },
  { value: "paid", label: "Paid" },
  { value: "inactive", label: "Inactive" },
  { value: "churned", label: "Churned" },
] as const;

/** Automation triggers available to Marketing Partners. */
export const AUTOMATION_TRIGGERS = [
  { value: "new_lead", label: "New lead signs up", hint: "Fires after someone joins through your link." },
  { value: "activated", label: "Lead creates first design", hint: "Fires after their first design." },
  { value: "low_credits", label: "Lead is low on credits", hint: "10 credits or fewer remaining." },
  { value: "exhausted", label: "Lead runs out of credits", hint: "No credits left." },
  { value: "inactive", label: "Lead goes quiet", hint: "No activity for over a week." },
  { value: "paid", label: "Lead becomes a paying user", hint: "Fires after their first payment." },
] as const;
