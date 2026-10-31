import 'server-only';
export function invitationEmailConfigured() { return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM); }
export async function sendInvitationEmail(email: string, link: string, invitationId: string) {
  if (!invitationEmailConfigured()) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `invitation/${invitationId}` },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: 'Your Saloonsync salon invitation',
        text: `You have been invited to join a salon workspace on Saloonsync.\n\nOpen this link in your browser and sign in with this email address:\n${link}\n\nThis invitation expires in 72 hours. If you were not expecting an invitation, you can ignore this email.` }),
    });
    // Never log provider bodies, recipient addresses, tokens, or authorization headers.
    return response.ok;
  } catch { return false; }
}
