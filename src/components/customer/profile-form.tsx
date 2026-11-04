'use client';

import { useActionState } from 'react';
import { updateCustomerProfile } from '@/server/customer-booking-actions';

export function CustomerProfileEditForm({
  displayName,
  phone,
  email,
}: {
  displayName: string;
  phone: string;
  email: string;
}) {
  const [state, action, isPending] = useActionState(updateCustomerProfile, {});

  return (
    <form action={action} className="form customer-profile-form">
      {state.message && <p className="status" role="status">{state.message}</p>}
      {state.error && <p className="status error" role="alert">{state.error}</p>}

      <div className="field">
        <label htmlFor="customerName">Full Name</label>
        <input
          id="customerName"
          name="displayName"
          type="text"
          defaultValue={displayName}
          required
          maxLength={120}
          suppressHydrationWarning
        />
      </div>

      <div className="field">
        <label htmlFor="customerPhone">Mobile Number</label>
        <input
          id="customerPhone"
          name="phone"
          type="tel"
          defaultValue={phone}
          placeholder="+91 98765 43210"
          maxLength={30}
          suppressHydrationWarning
        />
        <span className="hint">Used for appointment confirmations & salon front-desk lookups</span>
      </div>

      <div className="field">
        <label>Email Address</label>
        <input
          type="email"
          value={email}
          readOnly
          className="read-only-field"
          suppressHydrationWarning
        />
        <span className="hint">Managed via your verified account identity</span>
      </div>

      <button type="submit" className="primary" disabled={isPending} style={{ marginTop: 8 }} suppressHydrationWarning>
        {isPending ? 'Saving Details...' : 'Save Profile Changes'}
      </button>
    </form>
  );
}
