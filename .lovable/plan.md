

## Plan: Admin Notification on Affiliate Application

### What
Send an email to all admin users when a new affiliate submits an application, so admins can review and approve/reject promptly.

### Changes

#### 1. New email template in `send-email/index.ts`

Add `affiliate_application_admin_notify` template containing:
- Applicant's name, email, WhatsApp number, location
- Whether they were recruited by another affiliate
- CTA button: "Review Applications" → `/admin` page

#### 2. Admin email resolution in `send-email/index.ts`

Add a helper (reusing the pattern from `trace-alert`) that queries `user_roles` for admin users, then fetches their emails via `supabase.auth.admin.getUserById()`. When the template type is `affiliate_application_admin_notify` and `to` is set to a special value like `__admins__`, resolve and send to all admin emails.

#### 3. Trigger in `AffiliateSignup.tsx`

After the existing application-received email to the applicant, add a second `send-email` invocation:
```
type: "affiliate_application_admin_notify"
to: "__admins__"
data: { name, email, whatsapp, location, recruited_by }
```

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/send-email/index.ts` | Add admin notification template + admin email resolution logic |
| `src/pages/AffiliateSignup.tsx` | Add send-email call for admin notification after applicant email |

