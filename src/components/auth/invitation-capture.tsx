'use client';
import { useEffect, useState } from 'react';
export function InvitationCapture() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!token) return;
    // Fragment keeps raw tokens out of HTTP URLs, access logs and referrers.
    window.history.replaceState(null, '', window.location.pathname);
    fetch('/api/invitation-context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(r => { if (!r.ok) throw new Error(); setMessage('Invitation saved for this browser. Sign in or create an account using your invited email.'); })
      .catch(() => setMessage('Could not save this invitation. Open the original link and try again.'));
  }, []);
  return message ? <p role="status" className="notice">{message}</p> : null;
}
