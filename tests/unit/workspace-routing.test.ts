import { expect, it } from 'vitest';
import { chooseWorkspace } from '@/lib/auth/workspace-routing';
it('offers selection/onboarding when there is no active membership', () => expect(chooseWorkspace([], 'revoked-workspace')).toBeNull());
it('opens a single active workspace', () => expect(chooseWorkspace(['salon-a'])).toBe('salon-a'));
it('requires selection for multiple workspaces', () => expect(chooseWorkspace(['salon-a', 'salon-b'])).toBeNull());
it('preserves a currently authorized selection', () => expect(chooseWorkspace(['salon-a', 'salon-b'], 'salon-b')).toBe('salon-b'));
it('does not authorize a tampered or revoked workspace cookie', () => expect(chooseWorkspace(['salon-a', 'salon-b'], 'other-salon')).toBeNull());
