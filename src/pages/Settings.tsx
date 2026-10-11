import { useEffect, useState } from 'react';
import { Bell, Check, ChevronLeft, ExternalLink, LayoutGrid, LogOut, Moon, ShieldCheck, Sparkles, Sun, UserRound, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';

const THEME_KEY = 'academicvault_theme';
const COMPACT_KEY = 'academicvault_compact_layout';
const MOTION_KEY = 'academicvault_reduced_motion';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" className={`settings-toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}

export default function Settings() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) !== 'light');
  const [compact, setCompact] = useState(() => localStorage.getItem(COMPACT_KEY) === 'true');
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem(MOTION_KEY) === 'true');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Settings · AcademicVault';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.classList.toggle('compact-layout', compact);
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''));
  }, [compact, dark, reducedMotion]);

  function updateTheme(value: boolean) {
    setDark(value);
    document.documentElement.dataset.theme = value ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, value ? 'dark' : 'light');
  }

  function updateCompact(value: boolean) {
    setCompact(value);
    document.documentElement.classList.toggle('compact-layout', value);
    localStorage.setItem(COMPACT_KEY, String(value));
  }

  function updateMotion(value: boolean) {
    setReducedMotion(value);
    document.documentElement.classList.toggle('reduced-motion', value);
    localStorage.setItem(MOTION_KEY, String(value));
  }

  async function sendResetEmail() {
    if (!email) return;
    setBusy(true); setError(''); setMessage('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (resetError) setError(resetError.message);
    else setMessage('Password reset instructions sent to your email.');
    setBusy(false);
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (newPassword.length < 6) return setError('Password must be at least 6 characters.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    setPasswordBusy(true);
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) setError('Current password is incorrect.');
    else {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) setError(updateError.message);
      else { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage('Password changed successfully.'); }
    }
    setPasswordBusy(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return <div className="app settings-page">
    <header className="simple-header"><Link to="/dashboard" className="back-link"><ChevronLeft size={18}/> Dashboard</Link><Logo/></header>
    <main className="settings-shell">
      <div className="settings-heading"><div><p className="eyebrow">Personal controls</p><h1>Settings</h1><p className="muted">Shape AcademicVault around the way you study and work.</p></div><div className="settings-heading-icon"><Sparkles size={22}/></div></div>
      {(error || message) && <div className={error ? 'error' : 'success'}>{error || message}</div>}
      <div className="settings-grid">
        <section className="card settings-card"><div className="section-title"><div><h2>Account</h2><p className="muted">Manage your identity and access.</p></div><ShieldCheck size={20}/></div>
          <Link to="/profile" className="settings-action"><span className="settings-action-icon"><UserRound size={19}/></span><span><strong>Edit profile</strong><small>Update your academic details and public links.</small></span><ExternalLink size={17}/></Link>
          <div className="settings-action settings-action-button" role="button" tabIndex={0} onClick={sendResetEmail} onKeyDown={(event) => event.key === 'Enter' && sendResetEmail()}><span className="settings-action-icon"><ShieldCheck size={19}/></span><span><strong>Reset password</strong><small>{busy ? 'Sending instructions…' : `Send reset instructions to ${email || 'your account'}.`}</small></span><span className="settings-action-status">{message ? <Check size={17}/> : 'Send'}</span></div>
          <form className="settings-password-form" onSubmit={changePassword}><strong>Change password</strong><small>Confirm your existing password before choosing a new one.</small><input className="input" type="password" autoComplete="current-password" placeholder="Current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required/><input className="input" type="password" minLength={6} autoComplete="new-password" placeholder="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required/><input className="input" type="password" minLength={6} autoComplete="new-password" placeholder="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required/><button className="btn primary" type="submit" disabled={passwordBusy}>{passwordBusy ? 'Verifying…' : 'Change password'}</button></form>
          <button type="button" className="settings-action settings-action-button danger-action" onClick={logout}><span className="settings-action-icon"><LogOut size={19}/></span><span><strong>Sign out</strong><small>End this session on this device.</small></span><LogOut size={17}/></button>
        </section>
        <section className="card settings-card"><div className="section-title"><div><h2>Appearance</h2><p className="muted">Tune the workspace for long study sessions.</p></div><LayoutGrid size={20}/></div>
          <div className="settings-preference"><span className="settings-preference-icon">{dark ? <Moon size={19}/> : <Sun size={19}/>}</span><span><strong>Dark mode</strong><small>Use a lower-glare color scheme across the app.</small></span><Toggle checked={dark} onChange={updateTheme} label="Toggle dark mode"/></div>
          <div className="settings-preference"><span className="settings-preference-icon"><LayoutGrid size={19}/></span><span><strong>Compact layout</strong><small>Fit more records and navigation items on screen.</small></span><Toggle checked={compact} onChange={updateCompact} label="Toggle compact layout"/></div>
          <div className="settings-preference"><span className="settings-preference-icon"><Zap size={19}/></span><span><strong>Reduce motion</strong><small>Minimize transitions and animated effects.</small></span><Toggle checked={reducedMotion} onChange={updateMotion} label="Toggle reduced motion"/></div>
        </section>
        <section className="card settings-card settings-note"><Bell size={20}/><div><h2>Notifications</h2><p className="muted">AcademicVault currently keeps notifications quiet and local. Important account messages, such as password reset instructions, are sent only through your email provider.</p></div></section>
      </div>
    </main>
  </div>;
}
