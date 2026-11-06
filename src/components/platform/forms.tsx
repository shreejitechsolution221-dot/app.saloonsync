'use client';
import { useActionState, useId } from 'react';
import { savePlatformRecord, updateSalonStatus, updateUserStatus, acceptPlatformInvitation, inspectSupportMetadata, revokeSalonMembership } from '@/server/platform-console-actions';
import { fieldsFor, recordTypes, type RecordKind } from '@/lib/platform/catalog';
import { AuthStatusMessage, SubmitButton } from '@/components/auth/forms';

export type RecordView = { id: string; kind: string; title: string; status: string; salonId: string | null; assigneeId: string | null; version: number; payload: unknown };
export type Choice = { id: string; name: string };
export function RecordForm({ kind, record, salons = [], operators = [] }: { kind: RecordKind; record?: RecordView; salons?: Choice[]; operators?: Choice[] }) {
  const [state, action, pending] = useActionState(savePlatformRecord, {});
  const prefix = useId();
  const definition = recordTypes[kind];
  const payload = (record?.payload ?? {}) as Record<string, string | number>;
  return <form action={action} className="form pa-form">
    <input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={record?.id ?? ''}/><input type="hidden" name="version" value={record?.version ?? 0}/>
    <label htmlFor={`${prefix}-title`}>{kind === 'plan' ? 'Plan name' : 'Title'}<input id={`${prefix}-title`} name="title" defaultValue={record?.title ?? (kind === 'settings' ? 'SaloonSync' : '')} required maxLength={160}/></label>
    <label htmlFor={`${prefix}-status`}>Status<select id={`${prefix}-status`} name="status" defaultValue={record?.status ?? definition.statuses[0]}>{definition.statuses.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
    {!['plan', 'settings', 'preference', 'policy', 'template', 'invitation'].includes(kind) ? <label htmlFor={`${prefix}-salon`}>Target salon<select id={`${prefix}-salon`} name="salonId" defaultValue={record?.salonId ?? ''}><option value="">All salons / platform</option>{salons.map(salon => <option value={salon.id} key={salon.id}>{salon.name}</option>)}</select></label> : <input type="hidden" name="salonId" value=""/>}
    {['ticket', 'access', 'incident', 'job', 'alert'].includes(kind) ? <label htmlFor={`${prefix}-operator`}>Assigned operator<select id={`${prefix}-operator`} name="assigneeId" defaultValue={record?.assigneeId ?? ''}><option value="">Unassigned</option>{operators.map(operator => <option value={operator.id} key={operator.id}>{operator.name}</option>)}</select></label> : <input type="hidden" name="assigneeId" value=""/>}
    {fieldsFor(kind).map(field => <label key={field.name} htmlFor={`${prefix}-${field.name}`}>{field.label}{field.options ? <select id={`${prefix}-${field.name}`} name={field.name} defaultValue={String(payload[field.name] ?? field.options[0])}>{field.options.map(option => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select> : field.type === 'textarea' ? <textarea id={`${prefix}-${field.name}`} name={field.name} rows={4} defaultValue={payload[field.name] ?? ''} required={field.required} maxLength={8000}/> : <input id={`${prefix}-${field.name}`} name={field.name} type={field.type ?? 'text'} min={field.type === 'number' ? 0 : undefined} max={field.max} maxLength={field.name === 'code' ? 80 : 320} minLength={field.name === 'code' ? 2 : undefined} pattern={field.name === 'code' ? "[a-z][a-z0-9_.\\-]{1,79}" : undefined} placeholder={field.placeholder} aria-describedby={field.hint ? `${prefix}-${field.name}-hint` : undefined} defaultValue={payload[field.name] ?? (field.type === 'number' ? 0 : '')} required={field.required}/>} {field.hint && <small className="hint" id={`${prefix}-${field.name}-hint`}>{field.hint}</small>}</label>)}
    <AuthStatusMessage state={state}/><SubmitButton pending={pending}>{record ? 'Save changes' : `Create ${definition.label.toLowerCase()}`}</SubmitButton>
  </form>;
}
export function SalonReviewForm({ salon }: { salon: { id: string; status: string; updatedAt: string; stage: string; group?: string } }) {
  const [state, action, pending] = useActionState(updateSalonStatus, {}); const prefix = useId();
  return <form action={action} className="form pa-form"><input name="salonId" type="hidden" value={salon.id}/><input name="updatedAt" type="hidden" value={salon.updatedAt}/>
    <label htmlFor={`${prefix}-stage`}>Onboarding stage<select id={`${prefix}-stage`} name="stage" defaultValue={salon.stage}>{['registered', 'review', 'validated', 'active', 'monitoring', 'assistance'].map(stage => <option key={stage}>{stage}</option>)}</select></label>
    <label htmlFor={`${prefix}-status`}>Workspace status<select id={`${prefix}-status`} name="status" defaultValue={salon.status}><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
    <label htmlFor={`${prefix}-group`}>Rollout group<input id={`${prefix}-group`} name="group" maxLength={80} defaultValue={salon.group ?? ''}/></label><label htmlFor={`${prefix}-reason`}>Review / suspension reason<textarea id={`${prefix}-reason`} name="reason" required minLength={8} maxLength={1000}/></label><AuthStatusMessage state={state}/><SubmitButton pending={pending}>Save salon review</SubmitButton></form>;
}
export function UserStatusForm({ id, disabled }: { id: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(updateUserStatus, {}); const prefix = useId();
  return <form action={action} className="form pa-form"><input type="hidden" name="userId" value={id}/><label htmlFor={`${prefix}-status`}>Account status<select id={`${prefix}-status`} name="status" defaultValue={disabled ? 'disabled' : 'active'}><option value="active">Active</option><option value="disabled">Disabled</option></select></label><label htmlFor={`${prefix}-reason`}>Reason<textarea id={`${prefix}-reason`} name="reason" required minLength={8} maxLength={1000}/></label><AuthStatusMessage state={state}/><SubmitButton pending={pending}>Update account</SubmitButton></form>;
}
export function AcceptInvitationForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(acceptPlatformInvitation, {});
  return <form action={action} className="form"><input type="hidden" name="id" value={id}/><AuthStatusMessage state={state}/><SubmitButton pending={pending}>Accept platform invitation</SubmitButton></form>;
}
export function SupportMetadataForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(inspectSupportMetadata, {});
  return <form action={action} className="form pa-form"><input type="hidden" name="id" value={id}/>{state.error && <p role="alert">{state.error}</p>}{state.message && <pre className="pa-record-text" aria-live="polite">{state.message}</pre>}<SubmitButton pending={pending}>Inspect approved metadata</SubmitButton></form>;
}
export function RevokeMembershipForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revokeSalonMembership, {}); const prefix = useId();
  return <form action={action} className="form pa-form"><input type="hidden" name="id" value={id}/><label htmlFor={`${prefix}-reason`}>Revocation reason<textarea id={`${prefix}-reason`} name="reason" required minLength={8} maxLength={1000}/></label><AuthStatusMessage state={state}/><SubmitButton pending={pending}>Revoke salon membership</SubmitButton></form>;
}
