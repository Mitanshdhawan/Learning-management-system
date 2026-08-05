import { Resend } from 'resend'
import { env } from '../env'

// Only create a client when a key is configured. Without one, we fall back to
// logging the link — so local dev and un-configured environments never break.
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

function inviteHtml(acceptUrl: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h1 style="font-size:20px;margin:0 0 8px">You're invited to TOP LMS 🎉</h1>
    <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 20px">
      You've been invited to join the TOP LMS learning platform. Click below to set up your account and get started.
    </p>
    <a href="${acceptUrl}"
       style="display:inline-block;background:#6d5efc;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px">
      Set up your account
    </a>
    <p style="font-size:12px;line-height:1.6;color:#888;margin:20px 0 0">
      Or paste this link into your browser:<br>
      <a href="${acceptUrl}" style="color:#6d5efc;word-break:break-all">${acceptUrl}</a>
    </p>
    <p style="font-size:12px;color:#aaa;margin:16px 0 0">This invitation expires in 7 days.</p>
  </div>`
}

/**
 * Send an invitation email. Best-effort: a send failure is logged but never
 * thrown, so creating the invite always succeeds and the admin still has the
 * copyable share link as a fallback.
 */
export async function sendInviteEmail(to: string, acceptUrl: string): Promise<void> {
  if (!resend) {
    console.log(`\n📧 [email stub] Invitation for ${to}\n   Accept link: ${acceptUrl}\n`)
    return
  }
  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: "You're invited to TOP LMS",
      html: inviteHtml(acceptUrl),
      text: `You've been invited to TOP LMS. Set up your account: ${acceptUrl}`,
    })
    if (error) console.error('Resend rejected the invite email:', error)
  } catch (err) {
    console.error('Failed to send invite email:', err)
  }
}
