import { useEffect, useState } from 'react';
import { ArrowLeft, Download, Edit3, ExternalLink, FileText, Loader2, Save, Trash2, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';
import { downloadFile, openFileLocation } from '../lib/fileActions';

type Profile = { full_name: string; email: string | null; college: string | null; university: string | null; degree: string | null; branch: string | null; batch: string | null; linkedin: string | null; github: string | null; portfolio: string | null; bio: string | null };
type ResumeData = { profile: Profile; projects: any[]; internships: any[]; certificates: any[]; courses: any[]; skills: any[]; achievements: any[] };
type SavedResume = { id: string; name: string; savedAt: string; data: ResumeData };
type StoredResume = { id: string; name: string; path: string; size: number; type: string; savedAt: string };

export default function Resume() {
  const [data, setData] = useState<ResumeData | null>(null);
  const [userId, setUserId] = useState('');
  const [resumeName, setResumeName] = useState('My Academic Resume');
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [storedFiles, setStoredFiles] = useState<StoredResume[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Please sign in again.'); setLoading(false); return; }
      setUserId(user.id);
      try { setSavedResumes(JSON.parse(localStorage.getItem(`academicvault_resumes_${user.id}`) || '[]')); } catch { setSavedResumes([]); }
      try { setStoredFiles(JSON.parse(localStorage.getItem(`academicvault_resume_files_${user.id}`) || '[]')); } catch { setStoredFiles([]); }
      const [profile, projects, internships, certificates, courses, skills, achievements] = await Promise.all([
        supabase.from('student_profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('projects').select('title,description,technologies,github_url,live_demo_url').order('created_at', { ascending: false }),
        supabase.from('internships').select('company,role,description,technologies,skills,start_date,end_date').order('created_at', { ascending: false }),
        supabase.from('certificates').select('certificate_title,issuing_organization,issue_date,skills').order('created_at', { ascending: false }),
        supabase.from('courses').select('course_name,platform,status,completion_date,skills_learned').order('created_at', { ascending: false }),
        supabase.from('skills').select('name,category').order('created_at', { ascending: false }),
        supabase.from('achievements').select('title,organization,achievement_date,description').order('created_at', { ascending: false }),
      ]);
      const firstError = [profile, projects, internships, certificates, courses, skills, achievements].find(result => result.error);
      if (firstError?.error) setError(firstError.error.message);
      else setData({ profile: { ...profile.data, email: user.email ?? profile.data?.email ?? '' } as Profile, projects: projects.data ?? [], internships: internships.data ?? [], certificates: certificates.data ?? [], courses: courses.data ?? [], skills: skills.data ?? [], achievements: achievements.data ?? [] });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="auth-shell"><Loader2 className="spin" /><span className="muted">Preparing your resume…</span></div>;
  if (error || !data) return <div className="auth-shell"><div className="card resume-error"><Logo /><h2>Resume unavailable</h2><p className="muted">{error || 'Add profile data before generating a resume.'}</p><Link className="btn primary" to="/profile">Open profile</Link></div></div>;
  const { profile, projects, internships, certificates, courses, skills, achievements } = data;
  const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '';
  const list = (values: any[]) => values.flatMap(value => Array.isArray(value) ? value : []).filter(Boolean).join(' · ');
  function persist(next: SavedResume[]) {
    setSavedResumes(next);
    localStorage.setItem(`academicvault_resumes_${userId}`, JSON.stringify(next));
  }
  function saveResume() {
    const name = resumeName.trim() || 'My Academic Resume';
    if (editingId) {
      persist(savedResumes.map(item => item.id === editingId ? { ...item, name, savedAt: new Date().toISOString(), data } : item));
      return;
    }
    persist([{ id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), data }, ...savedResumes].slice(0, 12));
  }
  function deleteResume(id: string) { persist(savedResumes.filter(item => item.id !== id)); }
  function editResume(item: SavedResume) { setData(item.data); setResumeName(item.name); setEditingId(item.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function newResume() { setEditingId(null); setResumeName('My Academic Resume'); }
  function persistFiles(next: StoredResume[]) {
    setStoredFiles(next);
    localStorage.setItem(`academicvault_resume_files_${userId}`, JSON.stringify(next));
  }
  async function storeFile(file: File) {
    if (!supabase) return;
    if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) { setError('Please choose a PDF, DOC, or DOCX resume.'); return; }
    if (file.size > 15 * 1024 * 1024) { setError('Resume files must be 15 MB or smaller.'); return; }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${userId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('resumes').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      persistFiles([{ id: crypto.randomUUID(), name: file.name, path, size: file.size, type: file.type, savedAt: new Date().toISOString() }, ...storedFiles].slice(0, 20));
    } catch (err: any) { setError(err.message || 'Could not store the resume file.'); }
    finally { setUploading(false); }
  }
  async function removeFile(item: StoredResume) {
    if (!supabase || !window.confirm(`Delete ${item.name}?`)) return;
    const { error: removeError } = await supabase.storage.from('resumes').remove([item.path]);
    if (removeError) { setError(removeError.message); return; }
    persistFiles(storedFiles.filter(file => file.id !== item.id));
  }

  return <div className="app resume-app"><header className="simple-header resume-toolbar"><Link className="back-link" to="/dashboard"><ArrowLeft size={17} /> Dashboard</Link><div className="resume-toolbar-title"><FileText size={18} /><strong>Resume builder</strong></div><div className="resume-toolbar-actions">{editingId && <button className="btn secondary" onClick={newResume}><X size={16} /> New version</button>}<button className="btn secondary" onClick={saveResume}><Save size={16} /> {editingId ? 'Update resume' : 'Save resume'}</button><button className="btn primary" onClick={() => window.print()}><Download size={16} /> Print / PDF</button></div></header><main className="resume-shell"><div className="resume-intro"><div><p className="eyebrow">Generated from your vault</p><h1>Resume preview</h1><p className="muted">Your profile and portfolio data stay editable in AcademicVault.</p></div><Link className="btn secondary" to="/profile">Edit profile</Link></div><section className="resume-save-panel card"><div><strong>{editingId ? 'Edit saved version' : 'Save a version'}</strong><p className="muted">Keep different resumes for internships, placements, or scholarships.</p></div><div className="resume-save-controls"><input className="input" value={resumeName} onChange={e => setResumeName(e.target.value)} aria-label="Resume name" placeholder="Resume name" /><button className="btn primary" onClick={saveResume}><Save size={16} /> {editingId ? 'Update' : 'Save'}</button></div></section><section className="resume-file-store card"><div className="section-title"><div><h2>Resume store</h2><p className="muted">Keep PDF or Word resumes you created outside AcademicVault.</p></div><FileText size={19} /></div><label className="resume-upload"><Upload size={18} /><span>{uploading ? 'Storing resume…' : 'Choose resume file'}</span><small>PDF, DOC, or DOCX · max 15 MB</small><input type="file" accept="application/pdf,.doc,.docx" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) storeFile(file); e.currentTarget.value = ''; }} /></label>{storedFiles.length > 0 && <div className="stored-resume-list">{storedFiles.map(item => <div className="stored-resume-row" key={item.id}><div><strong>{item.name}</strong><span>{(item.size / 1024 / 1024).toFixed(2)} MB · Saved {new Date(item.savedAt).toLocaleDateString()}</span></div><div><button className="icon-btn" onClick={() => openFileLocation(supabase, 'resumes', item.path, item.name, item.type)} title="Open resume"><FileText size={16} /></button><button className="icon-btn" onClick={() => downloadFile(supabase, 'resumes', item.path, item.name, item.type)} title="Download resume"><Download size={16} /></button><button className="icon-btn danger-icon" onClick={() => removeFile(item)} title="Delete resume"><Trash2 size={16} /></button></div></div>)}</div>}</section>{savedResumes.length > 0 && <section className="saved-resumes card"><div className="section-title"><div><h2>Saved resumes</h2><p className="muted">Stored privately on this device.</p></div><FileText size={19} /></div><div className="saved-resume-list">{savedResumes.map(item => <div className={`saved-resume-row ${editingId === item.id ? 'editing' : ''}`} key={item.id}><div><strong>{item.name}</strong><span>Saved {new Date(item.savedAt).toLocaleDateString()}</span></div><div><button className="icon-btn" onClick={() => editResume(item)} title="Edit saved resume"><Edit3 size={16} /></button><button className="icon-btn danger-icon" onClick={() => deleteResume(item.id)} title="Delete saved resume"><Trash2 size={16} /></button></div></div>)}</div></section>}<article className="resume-paper"><header className="resume-paper-header"><div><h2>{profile.full_name || 'Your Name'}</h2><p>{[profile.degree, profile.branch, profile.college].filter(Boolean).join(' · ') || 'Academic professional'}</p></div><div className="resume-contact">{profile.email && <span>{profile.email}</span>}{profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn <ExternalLink size={11} /></a>}{profile.github && <a href={profile.github} target="_blank" rel="noreferrer">GitHub <ExternalLink size={11} /></a>}{profile.portfolio && <a href={profile.portfolio} target="_blank" rel="noreferrer">Portfolio <ExternalLink size={11} /></a>}</div></header>{profile.bio && <ResumeSection title="Profile"><p>{profile.bio}</p></ResumeSection>}{skills.length > 0 && <ResumeSection title="Skills"><div className="resume-skill-list">{skills.map((skill: any) => <span key={`${skill.name}-${skill.category}`}>{skill.name}{skill.category ? ` · ${skill.category}` : ''}</span>)}</div></ResumeSection>}{projects.length > 0 && <ResumeSection title="Projects">{projects.slice(0, 6).map((project: any) => <ResumeItem key={project.title} title={project.title} meta={list([project.technologies])} text={project.description} links={[project.github_url, project.live_demo_url]} />)}</ResumeSection>}{internships.length > 0 && <ResumeSection title="Experience">{internships.slice(0, 5).map((item: any) => <ResumeItem key={`${item.company}-${item.role}`} title={item.role || item.company} meta={[item.company, formatDate(item.start_date), formatDate(item.end_date)].filter(Boolean).join(' · ')} text={item.description} />)}</ResumeSection>}{achievements.length > 0 && <ResumeSection title="Achievements">{achievements.slice(0, 5).map((item: any) => <ResumeItem key={item.title} title={item.title} meta={[item.organization, formatDate(item.achievement_date)].filter(Boolean).join(' · ')} text={item.description} />)}</ResumeSection>}{certificates.length > 0 && <ResumeSection title="Certifications">{certificates.slice(0, 8).map((item: any) => <ResumeItem key={item.certificate_title} title={item.certificate_title} meta={[item.issuing_organization, formatDate(item.issue_date)].filter(Boolean).join(' · ')} text={list([item.skills])} />)}</ResumeSection>}{courses.length > 0 && <ResumeSection title="Courses">{courses.slice(0, 8).map((item: any) => <ResumeItem key={item.course_name} title={item.course_name} meta={[item.platform, item.status, formatDate(item.completion_date)].filter(Boolean).join(' · ')} text={list([item.skills_learned])} />)}</ResumeSection>}<footer className="resume-paper-footer">AcademicVault · {profile.batch ? `Batch ${profile.batch}` : 'Academic portfolio'}</footer></article></main></div>;
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="resume-section"><h3>{title}</h3>{children}</section>; }
function ResumeItem({ title, meta, text, links = [] }: { title: string; meta?: string; text?: string; links?: (string | null | undefined)[] }) { return <div className="resume-item"><div className="resume-item-heading"><strong>{title}</strong>{meta && <span>{meta}</span>}</div>{text && <p>{text}</p>}{links.filter(Boolean).length > 0 && <div className="resume-item-links">{links.filter(Boolean).map(link => <a key={link} href={link!} target="_blank" rel="noreferrer">Open link <ExternalLink size={11} /></a>)}</div>}</div>; }
