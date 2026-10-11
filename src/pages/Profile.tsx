import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, ChevronLeft, Github, Globe, Linkedin, Loader2, Save, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

type Profile = {
  id: string;
  full_name: string;
  profile_photo_url: string | null;
  student_id: string | null;
  college: string | null;
  university: string | null;
  degree: string | null;
  branch: string | null;
  batch: string | null;
  current_semester: string | null;
  email: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  bio: string | null;
};

const emptyProfile: Omit<Profile, 'id'> = {
  full_name: '', profile_photo_url: null, student_id: '', college: '', university: '', degree: '', branch: '',
  batch: '', current_semester: '', email: '', linkedin: '', github: '', portfolio: '', bio: ''
};

const completionFields: Array<keyof Omit<Profile, 'id'>> = [
  'full_name', 'profile_photo_url', 'student_id', 'college', 'university', 'degree', 'branch', 'batch',
  'current_semester', 'linkedin', 'github', 'portfolio', 'bio'
];

function completion(profile: Omit<Profile, 'id'>) {
  const completed = completionFields.filter((field) => Boolean(profile[field]?.toString().trim())).length;
  return Math.round((completed / completionFields.length) * 100);
}

export default function ProfilePage({ setup = false }: { setup?: boolean }) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Omit<Profile, 'id'>>(emptyProfile);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const percent = useMemo(() => completion(profile), [profile]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      setUserId(user.id);
      const { data, error: profileError } = await supabase.from('student_profiles').select('*').eq('id', user.id).maybeSingle();
      if (profileError) {
        setError(profileError.message);
      } else {
        setProfile({ ...emptyProfile, ...(data ?? {}), email: user.email ?? data?.email ?? '' });
        if (data?.profile_photo_url) await refreshPhoto(user.id, data.profile_photo_url);
      }
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  async function refreshPhoto(id: string, path: string) {
    if (!supabase || !path) return;
    const { data } = await supabase.storage.from('profile-photos').createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) setPhotoUrl(data.signedUrl);
  }

  function update(field: keyof Omit<Profile, 'id'>, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
    setMessage('');
  }

  async function uploadPhoto(file: File) {
    if (!supabase || !userId) return;
    setError(''); setMessage('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose a JPG, PNG, or WebP image.'); return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Profile photos must be 3 MB or smaller.'); return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('profile-photos').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('student_profiles').update({ profile_photo_url: path }).eq('id', userId);
      if (updateError) throw updateError;
      setProfile((current) => ({ ...current, profile_photo_url: path }));
      await refreshPhoto(userId, path);
      setMessage('Profile photo uploaded.');
    } catch (err: any) {
      setError(err.message || 'Could not upload the profile photo.');
    } finally {
      setUploading(false);
    }
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!supabase || !userId) return;
    setError(''); setMessage(''); setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...profile, email: user?.email ?? profile.email };
      const { error: saveError } = await supabase.from('student_profiles').update(payload).eq('id', userId);
      if (saveError) throw saveError;
      setProfile(payload);
      setMessage('Profile saved successfully.');
      if (setup) setTimeout(() => navigate('/dashboard'), 500);
    } catch (err: any) {
      setError(err.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (!supabase) return <div className="auth-shell"><div className="card" style={{ padding: 28, maxWidth: 520 }}><Logo/><h2>Connect Supabase</h2><p className="muted">Add your Supabase values to .env and restart the dev server.</p></div></div>;
  if (loading) return <div className="auth-shell"><div className="muted">Loading your profile…</div></div>;

  return <div className="app">
    <header className="simple-header"><Link to="/dashboard" className="back-link"><ChevronLeft size={18}/> Dashboard</Link><Logo/></header>
    <main className="profile-shell">
      <div className="profile-heading">
        <div>
          <p className="eyebrow">{setup ? 'First-time setup' : 'Your profile'}</p>
          <h1>{setup ? 'Build your academic profile' : 'Student profile'}</h1>
          <p className="muted">Keep your academic identity ready for your journey, records, and future sharing.</p>
        </div>
        <div className="completion-card"><div className="completion-top"><span>Profile completion</span><strong>{percent}%</strong></div><div className="progress"><span style={{ width: `${percent}%` }}/></div><small>{percent === 100 ? 'Your profile is complete.' : 'Complete more fields to strengthen your profile.'}</small></div>
      </div>

      <form onSubmit={save} className="profile-grid">
        <section className="card profile-card photo-card">
          <div className="section-title"><div><h2>Profile photo</h2><p className="muted">JPG, PNG or WebP · max 3 MB</p></div><Camera size={20}/></div>
          <div className="avatar-wrap">
            {photoUrl ? <img src={photoUrl} alt="Profile" className="avatar"/> : <div className="avatar placeholder"><UserRound size={42}/></div>}
            <button type="button" className="avatar-edit" onClick={() => fileRef.current?.click()} aria-label="Upload profile photo">{uploading ? <Loader2 size={16} className="spin"/> : <Camera size={16}/>}</button>
          </div>
          <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}/>
          <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Choose photo'}</button>
        </section>

        <section className="card profile-card">
          <div className="section-title"><div><h2>Personal information</h2><p className="muted">The basics used across AcademicVault.</p></div><CheckCircle2 size={20}/></div>
          <div className="form-grid">
            <Field label="Full name" value={profile.full_name} onChange={(v) => update('full_name', v)} required/>
            <Field label="Email" value={profile.email ?? ''} onChange={() => {}} type="email" disabled hint="Managed by your authenticated account"/>
            <Field label="USN / Student ID" value={profile.student_id ?? ''} onChange={(v) => update('student_id', v)} placeholder="e.g. 3GN23AI018"/>
            <Field label="College" value={profile.college ?? ''} onChange={(v) => update('college', v)} placeholder="College / Institution"/>
            <Field label="University" value={profile.university ?? ''} onChange={(v) => update('university', v)} placeholder="University"/>
            <Field label="Degree" value={profile.degree ?? ''} onChange={(v) => update('degree', v)} placeholder="e.g. B.E."/>
            <Field label="Branch" value={profile.branch ?? ''} onChange={(v) => update('branch', v)} placeholder="e.g. Artificial Intelligence & Machine Learning"/>
            <Field label="Batch" value={profile.batch ?? ''} onChange={(v) => update('batch', v)} placeholder="e.g. 2023–2027"/>
            <Field label="Current semester" value={profile.current_semester ?? ''} onChange={(v) => update('current_semester', v)} placeholder="e.g. 6th Semester"/>
          </div>
        </section>

        <section className="card profile-card full-card">
          <div className="section-title"><div><h2>Professional links</h2><p className="muted">Optional links you can use later on your shared profile.</p></div><Globe size={20}/></div>
          <div className="form-grid">
            <Field label="LinkedIn" value={profile.linkedin ?? ''} onChange={(v) => update('linkedin', v)} placeholder="https://linkedin.com/in/your-name" icon={<Linkedin size={17}/>}/>
            <Field label="GitHub" value={profile.github ?? ''} onChange={(v) => update('github', v)} placeholder="https://github.com/your-name" icon={<Github size={17}/>}/>
            <Field label="Portfolio" value={profile.portfolio ?? ''} onChange={(v) => update('portfolio', v)} placeholder="https://yourportfolio.com" icon={<Globe size={17}/>}/>
          </div>
          <label className="field full-field"><span>Short bio</span><textarea className="input textarea" rows={5} maxLength={500} value={profile.bio ?? ''} onChange={(e) => update('bio', e.target.value)} placeholder="Tell us briefly about your academic interests, strengths, or goals."/><small>{(profile.bio ?? '').length}/500</small></label>
        </section>

        {(error || message) && <div className={error ? 'error full-card' : 'success full-card'}>{error || message}</div>}
        <div className="profile-actions full-card"><Link to="/dashboard" className="btn secondary">{setup ? 'Skip for now' : 'Cancel'}</Link><button className="btn primary" type="submit" disabled={saving}>{saving ? <><Loader2 size={17} className="spin"/> Saving…</> : <><Save size={17}/> Save profile</>}</button></div>
      </form>
    </main>
  </div>;
}

function Field({ label, value, onChange, placeholder, type = 'text', required = false, disabled = false, hint, icon }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean; disabled?: boolean; hint?: string; icon?: React.ReactNode }) {
  return <label className="field"><span>{label}{required && ' *'}</span><div className="input-wrap">{icon}<input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} disabled={disabled}/></div>{hint && <small>{hint}</small>}</label>;
}
