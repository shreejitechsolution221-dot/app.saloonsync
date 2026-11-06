import { z } from 'zod';
import { fieldsFor, isRecordKind, recordTypes } from './catalog';

export const recordInput = z.object({
  id: z.union([z.uuid(), z.literal('')]), kind: z.string().refine(isRecordKind),
  title: z.string().trim().min(1).max(160), status: z.string(),
  salonId: z.union([z.uuid(), z.literal('')]), assigneeId: z.union([z.uuid(), z.literal('')]),
  version: z.coerce.number().int().min(0),
});
export function parseRecord(form: FormData) {
  const input = recordInput.parse(Object.fromEntries(form));
  if (!isRecordKind(input.kind)) throw new Error('Unknown record type.');
  const kind = input.kind;
  const definition = recordTypes[kind];
  if (!(definition.statuses as readonly string[]).includes(input.status)) throw new Error('Invalid status.');
  const payload: Record<string, string | number> = {};
  for (const field of fieldsFor(kind)) {
    const value = String(form.get(field.name) ?? '').trim();
    if (!value && field.required) throw new Error(`${field.label} is required.`);
    if (value.length > (field.type === 'textarea' ? 8000 : 320)) throw new Error(`${field.label} is too long.`);
    if (field.options && !field.options.includes(value)) throw new Error(`Choose a valid ${field.label}.`);
    if (field.type === 'number') {
      const number = Number(value || 0);
      if (!Number.isInteger(number) || number < 0 || number > (field.max ?? 1000000)) throw new Error(`Invalid ${field.label}.`);
      payload[field.name] = number;
    } else {
      if (value && field.type === 'email') z.email().parse(value);
      if (value && field.type === 'url') {
        const url = new URL(value);
        if (url.protocol !== 'https:') throw new Error('Legal links must use HTTPS.');
      }
      if (value && field.type === 'datetime-local' && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}Z`)))) throw new Error('Invalid UTC date.');
      payload[field.name] = value;
    }
  }
  if ('code' in payload && !/^[a-z][a-z0-9_.-]{1,79}$/.test(String(payload.code))) {
    const label=kind==='plan'?'Plan code':kind==='flag'?'Feature key':'Policy key';
    const example=kind==='plan'?'temp-starter':kind==='flag'?'online_booking':'booking-policy';
    throw new Error(`${label} must start with a lowercase letter and use 2–80 lowercase letters, numbers, dots, dashes or underscores. Example: ${example}.`);
  }
  if (kind === 'ticket' && ['verified', 'in_progress', 'escalated', 'resolved', 'closed'].includes(input.status) && !payload.verification) throw new Error('Verify the requester before progressing the case.');
  if (kind === 'access') {
    if (!input.salonId || !input.assigneeId) throw new Error('Choose the salon and requesting operator.');
    z.uuid().parse(payload.ticketId);
    const expiry = Date.parse(`${payload.expiresAt}Z`);
    if (['requested', 'approved'].includes(input.status) && (expiry <= Date.now() || expiry > Date.now() + 3600000)) throw new Error('Support access must expire within 60 minutes.');
  }
  if (kind === 'announcement' && payload.startsAt && payload.expiresAt && String(payload.startsAt) >= String(payload.expiresAt)) throw new Error('The end must follow the start.');
  if (kind === 'invitation') {
    payload.email = String(payload.email).toLowerCase();
    if (input.status === 'pending' && (Date.parse(`${payload.expiresAt}Z`) <= Date.now() || Date.parse(`${payload.expiresAt}Z`) > Date.now() + 7 * 86400000)) throw new Error('Invitations must expire within seven days.');
  }
  return { ...input, kind, payload };
}
