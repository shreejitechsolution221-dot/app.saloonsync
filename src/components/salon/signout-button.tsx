'use client';
import { useFormStatus } from 'react-dom';
import { Icon } from './icons';

export function SignOutButton() {
  const { pending } = useFormStatus();
  return <button className="account-action account-signout" type="submit" disabled={pending} aria-busy={pending}>
    {pending ? <span className="ui-spinner" aria-hidden="true"/> : <Icon name="logout"/>}
    <span>{pending ? 'Signing out…' : 'Sign out'}</span>
  </button>;
}
