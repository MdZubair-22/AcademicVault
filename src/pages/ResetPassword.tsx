import { FormEvent, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else { setMessage('Password updated. You can continue to your vault.'); setTimeout(() => navigate('/dashboard'), 900); }
    setBusy(false);
  }

  return <div className="auth-shell"><div className="card" style={{ padding: 32, maxWidth: 460, width: '100%' }}><Logo/><div className="reset-icon"><KeyRound size={22}/></div><h1>Set a new password</h1><p className="muted">Choose a new password for your AcademicVault account.</p><form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 24 }}><label>New password<input className="input" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required/></label><label>Confirm password<input className="input" type="password" minLength={6} value={confirm} onChange={(event) => setConfirm(event.target.value)} required/></label>{error && <div className="error">{error}</div>}{message && <div className="success">{message}</div>}<button className="btn primary" disabled={busy}>{busy ? <><Loader2 size={17} className="spin"/> Updating…</> : 'Update password'}</button></form><p className="muted" style={{ textAlign: 'center', marginTop: 20 }}><Link to="/login">Back to sign in</Link></p></div></div>;
}
