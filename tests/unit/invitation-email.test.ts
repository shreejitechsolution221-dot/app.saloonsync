import { afterEach, expect, it, vi } from 'vitest';
import { sendInvitationEmail } from '@/lib/email/invitations';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('does not send mail when email delivery is unconfigured', async () => {
  vi.stubEnv('RESEND_API_KEY', ''); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect(await sendInvitationEmail('person@example.test', 'https://app.test/#token=test', 'id')).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});
it('uses a server key and idempotency and confirms only provider acceptance', async () => {
  vi.stubEnv('RESEND_API_KEY', 'fake-test-key'); vi.stubEnv('EMAIL_FROM', 'sender@example.test');
  const fetcher = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', fetcher);
  expect(await sendInvitationEmail('person@example.test', 'https://app.test/#token=test', 'invite-id')).toBe(true);
  const [url, options] = fetcher.mock.calls[0]; expect(url).toBe('https://api.resend.com/emails');
  expect(options.headers['Idempotency-Key']).toBe('invitation/invite-id');
  expect(JSON.parse(options.body).to).toEqual(['person@example.test']);
});
it('does not claim delivery success on provider failure', async () => {
  vi.stubEnv('RESEND_API_KEY', 'fake-test-key'); vi.stubEnv('EMAIL_FROM', 'sender@example.test');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')));
  expect(await sendInvitationEmail('person@example.test', 'https://app.test/#token=test', 'id')).toBe(false);
});
