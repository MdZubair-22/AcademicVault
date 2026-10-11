import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';

export default function Auth({ mode }: { mode: 'login' | 'register' }) {
  const nav = useNavigate();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [msg, setMsg] = useState('');
  if (!supabase) return <div className="auth-shell"><div className="card" style={{padding:28,maxWidth:480,width:'100%'}}><Logo/><h2>Connect Supabase</h2><p className="muted">Copy .env.example to .env and add your Supabase project URL and publishable key.</p></div></div>;
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setMsg('');
    if (mode === 'register' && password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error;
        const { data: profile } = await supabase.from('student_profiles').select('student_id, college, university, degree, branch, batch, current_semester').maybeSingle();
        const incomplete = !profile?.student_id || !profile?.college || !profile?.university || !profile?.degree || !profile?.branch || !profile?.batch || !profile?.current_semester;
        nav(incomplete ? '/profile/setup' : '/dashboard');
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options:{data:{full_name:fullName}} });
        if (error) throw error;
        if (data.session) nav('/profile/setup'); else setMsg('Account created. Check your email to confirm your account, then sign in.');
      }
    } catch (err: any) { setError(err.message || 'Something went wrong.'); } finally { setBusy(false); }
  }
  async function forgot() {
    setError(''); setMsg(''); if (!email) return setError('Enter your email first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/reset-password' });
    if (error) setError(error.message); else setMsg('If the account exists, a reset email has been sent.');
  }
  return <div className="auth-shell"><div className="card" style={{padding:32,maxWidth:460,width:'100%'}}><Logo/><h1 style={{marginBottom:6}}>{mode==='login'?'Welcome back':'Create your vault'}</h1><p className="muted">Your entire academic journey, organized in one place.</p>
    <form onSubmit={submit} style={{display:'grid',gap:14,marginTop:24}}>
      {mode==='register'&&<label>Full name<input className="input" value={fullName} onChange={e=>setFullName(e.target.value)} required/></label>}
      <label>Email<input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
      <label>Password<input className="input" type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
      {mode==='register'&&<label>Confirm password<input className="input" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>}
      {error&&<div className="error">{error}</div>}{msg&&<div className="success">{msg}</div>}
      <button className="btn primary" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button>
    </form>
    {mode==='login'&&<button type="button" className="btn" style={{background:'transparent',color:'#4338ca',width:'100%',marginTop:10}} onClick={forgot}><KeyRound size={16}/> Reset password by email</button>}
    <p className="muted" style={{textAlign:'center',marginTop:20}}>{mode==='login'?<>New here? <a href="/register">Create an account</a></>:<>Already have an account? <a href="/login">Sign in</a></>}</p>
  </div></div>;
}
