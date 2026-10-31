import { describe, expect, it } from 'vitest';
import { permits, branchPermitted, canInvite } from '@/lib/authorization/policy';
import { safeDestination } from '@/lib/auth/redirects';
import { registrationSchema } from '@/lib/validation/auth';
describe('deny-by-default policy', () => {
  it.each(['customer', 'platform', 'system_admin', 'constructor', '__proto__', 'unknown'])('denies a global or unknown role: %s', role => expect(permits(role, 'appointment.manage')).toBe(false));
  it('distinguishes ownership, administration and operations', () => {
    expect(permits('owner', 'ownership.transfer')).toBe(true);
    expect(permits('admin', 'ownership.transfer')).toBe(false);
    expect(permits('manager', 'appointment.manage')).toBe(true);
    expect(permits('manager', 'membership.invite')).toBe(false);
    expect(permits('staff', 'appointment.manage')).toBe(false);
    expect(permits('staff', 'appointment.assigned.read')).toBe(true);
    expect(permits('owner', 'invented.permission')).toBe(false);
  });
  it('restricts selected branches and fails closed for unknown scopes', () => {
    expect(branchPermitted({ branchScope: 'selected', branches: [{ branchId: 'a' }] }, 'b')).toBe(false);
    expect(branchPermitted({ branchScope: 'selected', branches: [{ branchId: 'a' }] }, 'a')).toBe(true);
    expect(branchPermitted({ branchScope: 'unknown', branches: [] }, 'a')).toBe(false);
  });
  it('prevents delegated privilege escalation', () => {
    expect(canInvite('admin', 'admin')).toBe(false);
    expect(canInvite('admin', 'owner')).toBe(false);
    expect(canInvite('owner', 'owner')).toBe(false);
    expect(canInvite('owner', 'admin')).toBe(true);
    expect(canInvite('manager', 'staff')).toBe(false);
  });
});
describe('redirect allowlist', () => {
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/%2f%2fevil.test', '/salon?next=https://evil.test', '/salon/../platform', '/auth/callback', '/salon#evil'])('rejects %s', value => expect(safeDestination(value)).toBe('/salon'));
  it('accepts explicit internal destinations', () => expect(safeDestination('/salon/invitations/accept')).toBe('/salon/invitations/accept'));
});
describe('registration validation', () => {
  const valid = { name: 'A Person', email: 'person@example.test', password: 'a-long-test-password', confirmation: 'a-long-test-password', consent: 'on' };
  it('requires consent', () => expect(registrationSchema(12).safeParse({ ...valid, consent: '' }).success).toBe(false));
  it('rejects password mismatch', () => expect(registrationSchema(12).safeParse({ ...valid, confirmation: 'different' }).success).toBe(false));
  it('enforces configured password minimum', () => expect(registrationSchema(24).safeParse(valid).success).toBe(false));
});
