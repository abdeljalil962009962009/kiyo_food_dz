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
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#fb4f0a;color:#ffffff;text-decoration:none;font-weight:700;border-radius:12px;padding:14px 22px;">
                  Reset password
                </a>
              </p>
              <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#6b7280;">
                This link can expire or be used only once. If you did not request this reset, ignore this email and your password will stay unchanged.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                If the button does not work, copy and paste this link into your browser:<br />
                <span style="word-break:break-all;">{{ .ConfirmationURL }}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```

## Verification Checklist

- Send a reset email to a real address.
- Confirm the sender name displays as `Kiyo Food`.
- Confirm the link opens `/reset-password`.
- Confirm an expired or already-used link shows the Kiyo Food expired-link screen.
- Confirm a successful reset lets the user sign in with the new password.
