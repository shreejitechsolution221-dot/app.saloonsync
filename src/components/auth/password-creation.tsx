'use client';
import { useEffect, useState } from 'react';
import { passwordChecks, suggestPassword } from '@/lib/auth/passwords';
import { PasswordField } from './password-field';
type Strength = { score: number; warning: string; suggestions: string[] };
export function PasswordCreationFields({ minimum, fields }: { minimum: number; fields?: Record<string,string[]> }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [strength, setStrength] = useState<Strength | null>(null);
  const [suggested, setSuggested] = useState(false);
  const checks = passwordChecks(password, confirmation, minimum);
  useEffect(() => {
    let active = true; setStrength(null);
    if (!password) return;
    const timer = setTimeout(() => {
      import(/* webpackChunkName: "password-strength" */ '@/lib/auth/password-strength').then(({ checkStrength }) => {
        if (active) setStrength(checkStrength(password));
      }).catch(() => { /* Minimum and matching checks still work without the estimator. */ });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [password]);
  const mismatch = confirmation.length > 0 && password !== confirmation;
  const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return <div className="password-creation">
    <PasswordField registration minimum={minimum} value={password} onValueChange={value => { setPassword(value); setSuggested(false); }} errors={fields?.password} liveError={password && !checks.longEnough ? `Use at least ${minimum} characters.` : undefined}/>
    <div className="password-guidance">
      <button className="password-suggest" type="button" onClick={() => { const value = suggestPassword(minimum); setPassword(value); setConfirmation(value); setSuggested(true); }}>Suggest a strong password</button>
      <span className="hint">Use a unique passphrase. Avoid names, repeated patterns and reused passwords.</span>
      {password && <div className="password-strength" role="status" aria-live="polite"><meter min={0} max={4} low={2} high={3} optimum={4} value={strength?.score ?? 0} aria-label="Estimated password strength"/>
        <span>{strength ? `Estimated strength: ${labels[strength.score]}` : 'Checking password strength…'}</span>
        {strength?.warning && <span className="hint">{strength.warning}</span>}
        <span className={checks.longEnough ? 'password-match' : 'field-error'}>{checks.longEnough ? 'Minimum length met.' : `At least ${minimum} characters needed.`}</span>
      </div>}
      {suggested && <span className="hint" role="status">Suggested password filled in both fields. Save it in your password manager.</span>}
    </div>
    <PasswordField registration confirmation minimum={minimum} value={confirmation} onValueChange={setConfirmation} errors={fields?.confirmation} liveError={mismatch ? 'Passwords do not match.' : undefined}/>
    {checks.matches && <span className="password-match" role="status">Passwords match.</span>}
  </div>;
}
