import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API = "https://api.resend.com/emails";
const APP_URL = "https://trybrandie.com";

function welcomeHtml(name: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Welcome to Brandie ✨</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Hey ${name || "there"},
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Your brand studio is ready. Brandie will remember your colours, fonts, tone, and personality — so every design feels unmistakably <strong>you</strong>.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      Head to the Design Studio and create your first graphic. Just describe what you need in plain English.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/design-studio" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Open Design Studio
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because you signed up for Brandie.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function referralRewardHtml(credits: number): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">You earned credits! 🎉</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Great news — someone joined Brandie using your referral link.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      We've added <strong>${credits} bonus credits</strong> to your account. Keep sharing to earn more!
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/design-studio" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Start Designing
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because someone used your Brandie referral link.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function outOfCreditsHtml(): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">You've used all your credits</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      You've reached your monthly generation limit. Your credits will reset next month, or you can upgrade for more.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      In the meantime, you can still browse and download your existing designs.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/plans" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View Plans
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because you reached your Brandie credit limit.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function paymentConfirmationHtml(plan: string, amount: number, currency: string): string {
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  const formattedAmount = new Intl.NumberFormat('en-NG', { 
    style: 'currency', 
    currency: currency || 'NGN',
    minimumFractionDigits: 0 
  }).format(amount);

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Payment Successful 🎊</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Thank you for upgrading to <strong>Brandie ${planName}</strong>!
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Your payment of <strong>${formattedAmount}</strong> has been confirmed. Your new plan is now active and you have access to all ${planName} features.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      Ready to create stunning branded graphics? Jump into the Design Studio.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/design-studio" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Start Designing
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">Questions? Reply to this email — we're here to help.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function lowCreditsHtml(remainingCredits: number, referralCode: string): string {
  const referralLink = `${APP_URL}/?ref=${referralCode}`;
  
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Running Low on Credits ⚡</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Heads up — you have <strong>${remainingCredits} credit${remainingCredits === 1 ? '' : 's'}</strong> left this month.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Need more? You've got options:
    </p>
    <ul style="font-size:16px;color:#1a1a2e;line-height:1.8;margin:0 0 24px;padding-left:20px;">
      <li><strong>Upgrade your plan</strong> for more monthly credits</li>
      <li><strong>Share your referral link</strong> and earn 5 bonus credits per signup</li>
    </ul>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding-bottom:16px;">
      <a href="${APP_URL}/plans" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View Plans
      </a>
    </td></tr></table>
    <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0;text-align:center;">
      Your referral link: <a href="${referralLink}" style="color:#c4a265;text-decoration:underline;">${referralLink}</a>
    </p>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because your Brandie credits are running low.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ============ AFFILIATE EMAIL TEMPLATES ============

function affiliateApplicationReceivedHtml(name: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Application Received 📨</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Hey ${name || "there"},
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Thanks for applying to the <strong>Brandie Affiliate Program</strong>! We're excited you want to partner with us.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      Our team will review your application and get back to you within 24-48 hours. Once approved, you'll get access to your affiliate dashboard and unique referral link.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Explore Brandie
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because you applied to the Brandie Affiliate Program.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function affiliateApprovedHtml(affiliateCode: string): string {
  const affiliateLink = `${APP_URL}/?aff=${affiliateCode}`;
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">You're Approved! 🎉</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Congratulations! Your application to the <strong>Brandie Affiliate Program</strong> has been approved.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      You'll earn <strong>20% commission</strong> on every payment made by users you refer. Here's your unique affiliate link:
    </p>
    <p style="font-size:14px;color:#1a1a2e;background:#e5e7eb;padding:12px 16px;border-radius:8px;margin:0 0 24px;word-break:break-all;">
      <a href="${affiliateLink}" style="color:#1a1a2e;">${affiliateLink}</a>
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/affiliate" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Open Affiliate Dashboard
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because you were approved as a Brandie affiliate.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function affiliateRejectedHtml(): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Application Update</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Thank you for your interest in the Brandie Affiliate Program.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      After reviewing your application, we're unable to approve it at this time. This could be due to various factors related to our current program requirements.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      You're still welcome to use Brandie and refer friends using the regular referral program — you'll earn bonus credits for each signup!
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/design-studio" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Open Design Studio
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">Questions? Reply to this email — we're here to help.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function affiliateNewReferralHtml(referredEmail: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">New Referral! 🚀</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Great news! Someone just signed up using your affiliate link.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      <strong>${referredEmail}</strong> is now linked to your affiliate account. When they make a payment, you'll automatically earn your 20% commission.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      Keep sharing your link to grow your network and earnings!
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/affiliate" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View Dashboard
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because someone signed up using your Brandie affiliate link.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function affiliateCommissionEarnedHtml(
  commissionAmount: number,
  paymentAmount: number,
  commissionType?: string
): string {
  const formattedCommission = new Intl.NumberFormat('en-NG', { 
    style: 'currency', 
    currency: 'NGN',
    minimumFractionDigits: 0 
  }).format(commissionAmount);
  const formattedPayment = new Intl.NumberFormat('en-NG', { 
    style: 'currency', 
    currency: 'NGN',
    minimumFractionDigits: 0 
  }).format(paymentAmount);

  const typeLabels: Record<string, { source: string; rate: string }> = {
    tier1_first: { source: "Direct referral", rate: "20%" },
    tier1_recurring: { source: "Direct referral", rate: "5% lifetime" },
    tier2_first: { source: "Network (2nd-tier)", rate: "5%" },
    tier2_recurring: { source: "Network (2nd-tier)", rate: "3% lifetime" },
  };
  const info = typeLabels[commissionType || ""] || { source: "Referral", rate: "" };
  const rateLabel = info.rate ? ` (${info.rate})` : "";

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">You Earned Commission! 💰</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Cha-ching! A payment came through your ${info.source.toLowerCase()} network.
    </p>
    <p style="font-size:14px;color:#6b7280;margin:0 0 16px;padding:12px 16px;background:#f3f4f6;border-radius:8px;">
      Source: <strong style="color:#1a1a2e;">${info.source}</strong>
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Payment amount: <strong>${formattedPayment}</strong><br/>
      Your commission${rateLabel}: <strong style="color:#16a34a;">${formattedCommission}</strong>
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      This has been added to your pending balance. Request a payout anytime from your dashboard.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/affiliate" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View Earnings
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because you earned an affiliate commission on Brandie.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ============ NEW AFFILIATE TEMPLATES ============

function affiliateNewRecruitHtml(recruitName: string, recruitCode: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">New Affiliate Recruited! 🤝</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Great news — <strong>${recruitName || "someone"}</strong> just joined the Brandie Affiliate Program using your recruitment link!
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      As their recruiter, you'll automatically earn <strong>5% on their referrals' first payments</strong> and <strong>3% lifetime</strong> on recurring payments.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      Your network is growing — keep recruiting to build your passive income stream!
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/affiliate" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View My Network
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because someone joined Brandie using your recruitment link.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function affiliateNetworkReferralHtml(affiliateName: string, customerEmail: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Network Referral! 🌐</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Your recruited affiliate <strong>${affiliateName || "one of your partners"}</strong> just brought a new customer to Brandie!
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      <strong>${customerEmail}</strong> signed up and when they make a payment, you'll earn your 2nd-tier commission automatically.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      Your network is working for you — keep growing it!
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/affiliate" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View Network Earnings
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because a customer signed up via your recruited affiliate's link.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function affiliatePayoutThresholdHtml(totalEarned: number): string {
  const formatted = new Intl.NumberFormat('en-NG', { 
    style: 'currency', 
    currency: 'NGN',
    minimumFractionDigits: 0 
  }).format(totalEarned);

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Payout Ready! 🎊</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Congratulations! Your total earnings have reached <strong style="color:#16a34a;">${formatted}</strong> — you've hit the minimum payout threshold!
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      Head to your dashboard to request a payout. Make sure your bank details are up to date.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/affiliate" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Request Payout
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because your Brandie affiliate earnings reached the payout threshold.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function affiliatePayoutProcessedHtml(amount: number, status: "paid" | "rejected"): string {
  const formattedAmount = new Intl.NumberFormat('en-NG', { 
    style: 'currency', 
    currency: 'NGN',
    minimumFractionDigits: 0 
  }).format(amount);

  const isPaid = status === "paid";
  const title = isPaid ? "Payout Sent! 🏦" : "Payout Update";
  const message = isPaid
    ? `Your payout of <strong>${formattedAmount}</strong> has been sent to your bank account. It should arrive within 1-3 business days.`
    : `Your payout request of <strong>${formattedAmount}</strong> could not be processed at this time. The amount has been returned to your available balance. Please check your bank details are correct and try again.`;

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">${title}</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      ${message}
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/affiliate" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View Dashboard
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">Questions? Reply to this email — we're here to help.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function affiliateBroadcastHtml(headline: string, message: string, ctaText: string, ctaUrl: string): string {
  const paragraphs = message
    .split("\n")
    .filter((p) => p.trim())
    .map((p) => `<p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">${p}</p>`)
    .join("");

  const ctaBlock = ctaText && ctaUrl
    ? `<table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding-top:8px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
          ${ctaText}
        </a>
      </td></tr></table>`
    : "";

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <p style="color:#c4a265;font-size:13px;font-weight:600;letter-spacing:0.08em;margin:0 0 8px;text-transform:uppercase;">Affiliate Partner Update</p>
    <h1 style="color:#ffffff;font-size:26px;margin:0;font-weight:700;line-height:1.3;">${headline}</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    ${paragraphs}
    ${ctaBlock}
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this as an approved Brandie Affiliate Partner.</p>
    <p style="font-size:13px;color:#9ca3af;margin:6px 0 0;">
      <a href="${APP_URL}/affiliate" style="color:#c4a265;text-decoration:underline;">View your dashboard</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function campaignHtml(headline: string, message: string, ctaText: string, ctaUrl: string): string {
  const paragraphs = message
    .split("\n")
    .filter((p) => p.trim())
    .map((p) => `<p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">${p}</p>`)
    .join("");

  const ctaBlock = ctaText && ctaUrl
    ? `<table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding-top:8px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
          ${ctaText}
        </a>
      </td></tr></table>`
    : "";

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;font-size:26px;margin:0;font-weight:700;line-height:1.3;">${headline}</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    ${paragraphs}
    ${ctaBlock}
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this from Brandie.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function dailyContentReminderHtml(name: string, dateStr: string, ideas: Array<{ title: string; pillar?: string; series?: string }>): string {
  const ideaRows = ideas.map((idea) => {
    let label = idea.title;
    const tags: string[] = [];
    if (idea.pillar) tags.push(idea.pillar);
    if (idea.series) tags.push(idea.series);
    const tagStr = tags.length > 0 ? ` <span style="color:#9ca3af;font-size:13px;">(${tags.join(" · ")})</span>` : "";
    return `<li style="font-size:16px;color:#1a1a2e;line-height:1.8;">${label}${tagStr}</li>`;
  }).join("");

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Today's Content 📅</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Hey ${name || "there"},
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      You have <strong>${ideas.length} content idea${ideas.length === 1 ? "" : "s"}</strong> scheduled for today, <strong>${dateStr}</strong>:
    </p>
    <ul style="margin:0 0 24px;padding-left:20px;">
      ${ideaRows}
    </ul>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/content" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Open Content Hub
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because you have content scheduled on Brandie today.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function affiliateMonthlyDigestHtml(data: any): string {
  const fmt = (n: number) => `₦${n.toLocaleString("en-NG")}`;
  const hasNetwork = data.total_network > 0 || data.network_earnings > 0;

  const networkSection = hasNetwork ? `
    <tr><td colspan="2" style="padding:16px 0 8px;font-size:14px;font-weight:700;color:#c4a265;text-transform:uppercase;letter-spacing:1px;border-top:1px solid #e5e7eb;">Network</td></tr>
    <tr><td style="padding:6px 0;font-size:15px;color:#555;">Network earnings</td><td style="padding:6px 0;font-size:15px;color:#1a1a2e;font-weight:600;text-align:right;">${fmt(data.network_earnings)}</td></tr>
    <tr><td style="padding:6px 0;font-size:15px;color:#555;">New recruits this month</td><td style="padding:6px 0;font-size:15px;color:#1a1a2e;font-weight:600;text-align:right;">${data.new_recruits}</td></tr>
    <tr><td style="padding:6px 0;font-size:15px;color:#555;">Total network size</td><td style="padding:6px 0;font-size:15px;color:#1a1a2e;font-weight:600;text-align:right;">${data.total_network}</td></tr>
  ` : "";

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:26px;margin:0;font-weight:700;">Monthly Earnings Report 📊</h1>
    <p style="color:#9ca3af;font-size:14px;margin:8px 0 0;">${data.month}</p>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td colspan="2" style="padding:0 0 8px;font-size:14px;font-weight:700;color:#c4a265;text-transform:uppercase;letter-spacing:1px;">Earnings</td></tr>
      <tr><td style="padding:6px 0;font-size:15px;color:#555;">Total this month</td><td style="padding:6px 0;font-size:22px;color:#1a1a2e;font-weight:700;text-align:right;">${fmt(data.monthly_earnings)}</td></tr>
      <tr><td style="padding:6px 0;font-size:15px;color:#555;">Direct commissions</td><td style="padding:6px 0;font-size:15px;color:#1a1a2e;font-weight:600;text-align:right;">${fmt(data.direct_earnings)}</td></tr>

      <tr><td colspan="2" style="padding:16px 0 8px;font-size:14px;font-weight:700;color:#c4a265;text-transform:uppercase;letter-spacing:1px;border-top:1px solid #e5e7eb;">Referrals</td></tr>
      <tr><td style="padding:6px 0;font-size:15px;color:#555;">New referrals this month</td><td style="padding:6px 0;font-size:15px;color:#1a1a2e;font-weight:600;text-align:right;">${data.new_referrals}</td></tr>
      <tr><td style="padding:6px 0;font-size:15px;color:#555;">Total referrals (lifetime)</td><td style="padding:6px 0;font-size:15px;color:#1a1a2e;font-weight:600;text-align:right;">${data.total_referrals}</td></tr>

      ${networkSection}

      <tr><td colspan="2" style="padding:16px 0 8px;font-size:14px;font-weight:700;color:#c4a265;text-transform:uppercase;letter-spacing:1px;border-top:1px solid #e5e7eb;">Account</td></tr>
      <tr><td style="padding:6px 0;font-size:15px;color:#555;">Lifetime earned</td><td style="padding:6px 0;font-size:15px;color:#1a1a2e;font-weight:600;text-align:right;">${fmt(data.total_earned)}</td></tr>
      <tr><td style="padding:6px 0;font-size:15px;color:#555;">Total paid out</td><td style="padding:6px 0;font-size:15px;color:#1a1a2e;font-weight:600;text-align:right;">${fmt(data.total_paid)}</td></tr>
      <tr><td style="padding:6px 0;font-size:15px;color:#555;">Available balance</td><td style="padding:6px 0;font-size:18px;color:#16a34a;font-weight:700;text-align:right;">${fmt(data.balance)}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 40px 32px;">
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/affiliate/dashboard" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View Full Dashboard
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because you're a Brandie affiliate partner. This is your monthly performance summary.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function affiliateApplicationAdminNotifyHtml(data: {
  name?: string;
  email?: string;
  whatsapp?: string;
  location?: string;
  recruited_by?: string;
}): string {
  const rows = [
    ["Name", data.name || "—"],
    ["Email", data.email || "—"],
    ["WhatsApp", data.whatsapp || "—"],
    ["Location", data.location || "—"],
    ["Recruited by", data.recruited_by || "Organic (no recruiter)"],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">${label}</td><td style="padding:8px 12px;font-size:14px;color:#1a1a2e;border-bottom:1px solid #e5e7eb;font-weight:500;">${value}</td></tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">New Affiliate Application 📋</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      A new affiliate application has been submitted and is awaiting your review.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:0 0 24px;">
      ${rows}
    </table>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/admin" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Review Applications
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because you're a Brandie admin.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function resolveAdminEmails(): Promise<string[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (error || !roles?.length) return [];

  const emails: string[] = [];
  for (const r of roles) {
    const { data: authUser } = await supabase.auth.admin.getUserById(r.user_id);
    if (authUser?.user?.email) emails.push(authUser.user.email);
  }
  return emails;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let { type, to, data } = await req.json();

    if (!type || !to) {
      return new Response(JSON.stringify({ error: "Missing type or to" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve __admins__ → send to all admin users
    if (to === "__admins__") {
      const adminEmails = await resolveAdminEmails();
      if (!adminEmails.length) {
        return new Response(JSON.stringify({ error: "No admin emails found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build subject + html once, then send to each admin
      let subject: string;
      let html: string;

      if (type === "affiliate_application_admin_notify") {
        subject = "New Affiliate Application — Review Needed 📋";
        html = affiliateApplicationAdminNotifyHtml(data || {});
      } else {
        return new Response(JSON.stringify({ error: `__admins__ not supported for type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = [];
      for (const email of adminEmails) {
        const res = await fetch(RESEND_API, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Brandie <hello@trybrandie.com>",
            to: [email],
            subject,
            html,
          }),
        });
        const result = await res.json();
        results.push({ email, ok: res.ok, id: result.id });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve user ID to email if needed (for server-side email resolution)
    if (typeof to === "string" && to.startsWith("__resolve_user__:")) {
      const userId = to.replace("__resolve_user__:", "");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const resolvedEmail = authUser?.user?.email;
      if (!resolvedEmail) {
        return new Response(JSON.stringify({ error: "Could not resolve user email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      to = resolvedEmail;
    }

    let subject: string;
    let html: string;

    switch (type) {
      case "welcome":
        subject = "Welcome to Brandie — your brand studio is ready ✨";
        html = welcomeHtml(data?.name || "");
        break;
      case "referral_reward":
        subject = "You just earned bonus credits on Brandie! 🎉";
        html = referralRewardHtml(data?.credits || 5);
        break;
      case "out_of_credits":
        subject = "You've used all your Brandie credits this month";
        html = outOfCreditsHtml();
        break;
      case "payment_confirmation":
        subject = "Payment confirmed — welcome to Brandie " + (data?.plan ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1) : "") + " 🎊";
        html = paymentConfirmationHtml(data?.plan || "pro", data?.amount || 0, data?.currency || "NGN");
        break;
      case "low_credits":
        subject = "You're running low on Brandie credits ⚡";
        html = lowCreditsHtml(data?.remaining_credits || 0, data?.referral_code || "");
        break;
      // ============ AFFILIATE EMAILS ============
      case "affiliate_application_received":
        subject = "We received your Brandie Affiliate application 📨";
        html = affiliateApplicationReceivedHtml(data?.name || "");
        break;
      case "affiliate_approved":
        subject = "You're approved as a Brandie Affiliate! 🎉";
        html = affiliateApprovedHtml(data?.affiliate_code || "");
        break;
      case "affiliate_rejected":
        subject = "Update on your Brandie Affiliate application";
        html = affiliateRejectedHtml();
        break;
      case "affiliate_new_referral":
        subject = "New signup from your affiliate link! 🚀";
        html = affiliateNewReferralHtml(data?.referred_email || "A new user");
        break;
      case "affiliate_commission_earned":
        subject = "You earned affiliate commission on Brandie! 💰";
        html = affiliateCommissionEarnedHtml(data?.commission_amount || 0, data?.payment_amount || 0, data?.commission_type || "");
        break;
      case "affiliate_new_recruit":
        subject = "A new affiliate joined your network! 🤝";
        html = affiliateNewRecruitHtml(data?.recruit_name || "", data?.recruit_code || "");
        break;
      case "affiliate_network_referral":
        subject = "Your network brought a new customer! 🌐";
        html = affiliateNetworkReferralHtml(data?.affiliate_name || "", data?.customer_email || "");
        break;
      case "affiliate_payout_threshold":
        subject = "You've reached the payout threshold! 🎊";
        html = affiliatePayoutThresholdHtml(data?.total_earned || 0);
        break;
      case "affiliate_payout_processed":
        subject = data?.status === "paid" 
          ? "Your Brandie affiliate payout has been sent 🏦" 
          : "Update on your Brandie payout request";
        html = affiliatePayoutProcessedHtml(data?.amount || 0, data?.status || "paid");
        break;
      case "affiliate_broadcast":
        subject = data?.subject_line || "Message from the Brandie Team";
        html = affiliateBroadcastHtml(
          data?.headline || data?.subject_line || "A message from Brandie",
          data?.message || "",
          data?.cta_text || "",
          data?.cta_url || ""
        );
        break;
      case "campaign":
        subject = data?.subject_line || "A message from Brandie";
        html = campaignHtml(
          data?.headline || data?.subject_line || "A message from Brandie",
          data?.message || "",
          data?.cta_text || "",
          data?.cta_url || ""
        );
        break;
      case "daily_content_reminder":
        subject = `Your content plan for today — ${data?.date || "today"} 📅`;
        html = dailyContentReminderHtml(data?.name || "", data?.date || "today", data?.ideas || []);
        break;
      case "autopilot_design_ready":
        subject = `Your design is ready! ✨ — ${data?.idea_title || "New design"}`;
        html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#1a1a2e,#2d1b4e);padding:32px 40px;text-align:center;">
    <p style="font-size:48px;margin:0 0 8px;">⚡</p>
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Autopilot Delivered!</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Your scheduled design <strong>"${data?.idea_title || "Untitled"}"</strong> has been automatically created by Brandie.
    </p>
    ${data?.image_url ? `<img src="${data.image_url}" alt="Your design" style="width:100%;border-radius:12px;margin:0 0 24px;" />` : ""}
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/design-history" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View in Design History
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">This design was created automatically via Autopilot in your Content Hub.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
        break;
      case "autopilot_no_credits":
        subject = `Autopilot paused — not enough credits ⚡`;
        html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <p style="font-size:48px;margin:0 0 8px;">⏸️</p>
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Autopilot Paused</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Your scheduled design <strong>"${data?.idea_title || "Untitled"}"</strong> couldn't be created because you've run out of credits.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      <strong>Good news:</strong> Brandie will automatically retry this design for the next 3 days. Top up your credits and it'll pick up right where it left off.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      You can also manually retry from the Content Hub calendar.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding-bottom:12px;">
      <a href="${APP_URL}/plans" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Get More Credits
      </a>
    </td></tr><tr><td align="center">
      <a href="${APP_URL}/content" style="display:inline-block;color:#c4a265;font-weight:500;font-size:14px;text-decoration:underline;">
        Open Content Hub
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because Autopilot tried to generate a design but you had no credits left.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
        break;
      case "affiliate_monthly_digest":
        subject = `Your Brandie affiliate report — ${data?.month || "this month"} 📊`;
        html = affiliateMonthlyDigestHtml(data || {});
        break;
      case "affiliate_milestone": {
        const fmt = (n: number) => `₦${n.toLocaleString("en-NG")}`;
        const milestone = data?.milestone || 0;
        const totalEarned = data?.total_earned || 0;
        const emoji = milestone >= 1000000 ? "👑" : milestone >= 500000 ? "💎" : milestone >= 100000 ? "🔥" : milestone >= 50000 ? "⭐" : "🎉";
        subject = `You just hit ${fmt(milestone)} on Brandie! ${emoji}`;
        html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#1a1a2e,#2d1b4e);padding:40px;text-align:center;">
    <p style="font-size:64px;margin:0 0 8px;">${emoji}</p>
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Milestone Unlocked!</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;text-align:center;">
    <p style="font-size:18px;color:#1a1a2e;line-height:1.6;margin:0 0 8px;">You've earned a total of</p>
    <p style="font-size:40px;color:#c4a265;font-weight:800;margin:0 0 8px;">${fmt(milestone)}</p>
    <p style="font-size:16px;color:#555;line-height:1.6;margin:0 0 24px;">
      Your lifetime earnings are now <strong>${fmt(totalEarned)}</strong>. Keep sharing Brandie and growing your network — the next milestone is waiting!
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${APP_URL}/affiliate/dashboard" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View My Dashboard
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because you're a Brandie affiliate partner.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: type === "campaign" && data?.sender_name
          ? `${data.sender_name} <hello@trybrandie.com>`
          : "Brandie <hello@trybrandie.com>",
        to: [to],
        subject,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: result }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
