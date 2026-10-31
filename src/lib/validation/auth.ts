import { z } from 'zod';
export const emailSchema = z.string().trim().max(254).pipe(z.email()).transform(v => v.toLowerCase());
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(1024) });
export const mobileNumberSchema = z.string().trim().transform(v => v.replace(/[\s()-]/g, '')).pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a mobile number with country code, e.g. +91 98765 43210.'));
export function registrationSchema(minimum: number, portal: 'salon' | 'customer' = 'customer') {
  return z.object({ name: z.string().trim().min(2).max(120), email: emailSchema,
    password: z.string().min(minimum, `Use at least ${minimum} characters.`).max(128),
    confirmation: z.string(), consent: z.literal('on', { error: 'Accept the service terms to continue.' }),
    mobileNumber: portal === 'salon' ? mobileNumberSchema : z.unknown().optional().transform(() => undefined),
    salonName: portal === 'salon' ? z.string().trim().min(2, 'Enter your salon name.').max(100) : z.unknown().optional().transform(() => undefined),
  }).refine(v => v.password === v.confirmation, { path: ['confirmation'], message: 'Passwords do not match.' });
}
export const onboardingSchema = z.object({ name: z.string().trim().min(2).max(100), branch: z.string().trim().min(2).max(100), key: z.uuid() });
export const invitationSchema = z.object({ salonId: z.uuid(), email: emailSchema, role: z.enum(['admin', 'manager', 'staff', 'receptionist', 'inventory', 'accountant', 'cashier']), branchScope: z.enum(['all', 'selected']), branches: z.array(z.uuid()).max(100) }).refine(v => v.branchScope !== 'selected' || v.branches.length > 0, { message: 'Choose at least one branch.' });
