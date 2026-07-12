# Kiyo Food Supabase Auth Email Setup

Supabase Auth emails are configured in the Supabase Dashboard, not in the frontend bundle.
Use these settings before public launch.

## Required Settings

1. Open Supabase Dashboard.
2. Go to Authentication > URL Configuration.
3. Set Site URL to the production Vercel domain.
4. Add these Redirect URLs:
   - `https://YOUR_DOMAIN/auth/callback`
   - `https://YOUR_DOMAIN/reset-password`
   - `http://localhost:5173/auth/callback`
   - `http://localhost:5173/reset-password`
5. Go to Authentication > SMTP Settings.
6. Set Sender name to `Kiyo Food`.
7. Configure a real SMTP provider for production delivery.
8. Go to Authentication > Email Templates > Reset Password.
9. Use the branded template below.

## Reset Password Template

```html
<div style="margin:0;padding:0;background:#f7f4ef;font-family:Inter,Arial,sans-serif;color:#1f2933;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ef;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ece7dd;">
          <tr>
            <td style="background:#111827;padding:28px 32px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:.2px;">Kiyo Food</div>
              <div style="margin-top:6px;font-size:13px;color:#f4b183;">Secure account recovery</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#111827;">Reset your password</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b5563;">
                We received a request to reset your Kiyo Food password. Use the secure button below to choose a new password.
              </p>
              <p style="margin:0 0 26px;text-align:center;">
                <a href="{{ .SiteURL }}/reset-password#token_hash={{ .TokenHash }}&amp;type=recovery" style="display:inline-block;background:#fb4f0a;color:#ffffff;text-decoration:none;font-weight:700;border-radius:12px;padding:14px 22px;">
                  Reset password
                </a>
              </p>
              <div style="margin:0 0 22px;padding:16px;border:1px solid #fed7c3;border-radius:12px;background:#fff7f2;text-align:center;">
                <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#9a3412;">Recovery code</div>
                <div style="margin-top:6px;font-size:28px;font-weight:800;letter-spacing:6px;color:#111827;">{{ .Token }}</div>
              </div>
              <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#6b7280;">
                This link can expire or be used only once. If you did not request this reset, ignore this email and your password will stay unchanged.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                If the button does not work, copy and paste this link into your browser:<br />
                <span style="word-break:break-all;">{{ .SiteURL }}/reset-password#token_hash={{ .TokenHash }}&amp;type=recovery</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```

This template intentionally does not use `{{ .ConfirmationURL }}`. Security scanners can
open that single-use URL before the customer does. The Kiyo Food reset page receives the
token hash in the browser-only URL fragment without consuming it and verifies it only when
the customer submits a new password. The visible one-time code is an independent fallback
for email clients that damage links.
Disable click tracking for authentication emails in the SMTP provider as well.

## Verification Checklist

- Send a reset email to a real address.
- Confirm the sender name displays as `Kiyo Food`.
- Confirm the link opens `/reset-password`.
- Confirm an expired or already-used link shows the Kiyo Food expired-link screen.
- Confirm a successful reset lets the user sign in with the new password.
- Set the password recovery request cooldown to 60 seconds in Authentication > Rate Limits.
- Set email OTP expiry to 3600 seconds (one hour).
