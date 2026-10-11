import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, ChevronDown, ChevronRight, Edit3, GraduationCap, Loader2, Plus, Route as RouteIcon, Save, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

type AcademicYear = {
  id: string;
  year_label: string;
  start_year: number | null;
  end_year: number | null;
  sort_order: number;
  created_at: string;
};

type Semester = {
  id: string;
  academic_year_id: string;
  name: string;
  semester_number: number | null;
  status: 'planned' | 'in_progress' | 'completed';
  notes: string | null;
  sort_order: number;
};

const emptyYear = { year_label: '', start_year: '', end_year: '' };
const emptySemester = { name: '', semester_number: '', status: 'planned' as Semester['status'], notes: '' };
function getYearLabel(startYear: string, endYear: string) {
  return startYear && endYear ? `${startYear} – ${endYear}` : '';
}
function getSemesterName(semesterNumber: string) {
  return semesterNumber ? `Semester ${semesterNumber}` : '';
}

export default function Journey() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [yearModal, setYearModal] = useState(false);
  const [semesterModal, setSemesterModal] = useState<string | null>(null);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [yearForm, setYearForm] = useState(emptyYear);
  const [semesterForm, setSemesterForm] = useState(emptySemester);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    if (!supabase) return;
    setLoading(true); setError('');
    const [{ data: yearData, error: yearError }, { data: semesterData, error: semesterError }] = await Promise.all([
      supabase.from('academic_years').select('*').order('sort_order', { ascending: true }).order('start_year', { ascending: true }),
      supabase.from('semesters').select('*').order('sort_order', { ascending: true }).order('semester_number', { ascending: true })
    ]);
    if (yearError || semesterError) setError((yearError || semesterError)?.message || 'Could not load your academic journey.');
    setYears((yearData ?? []) as AcademicYear[]);
    setSemesters((semesterData ?? []) as Semester[]);
    const initial: Record<string, boolean> = {};
    (yearData ?? []).forEach((y: AcademicYear) => { initial[y.id] = true; });
    setExpanded(initial);
    setLoading(false);
  }

  function openNewYear() {
    setEditingYear(null); setYearForm(emptyYear); setError(''); setMessage(''); setYearModal(true);
  }

  function openEditYear(year: AcademicYear) {
    setEditingYear(year);
    setYearForm({ year_label: year.year_label, start_year: year.start_year?.toString() ?? '', end_year: year.end_year?.toString() ?? '' });
    setError(''); setMessage(''); setYearModal(true);
  }

  function openNewSemester(yearId: string) {
    setEditingSemester(null); setSemesterForm(emptySemester); setError(''); setMessage(''); setSemesterModal(yearId);
  }

  function openEditSemester(semester: Semester) {
    setEditingSemester(semester);
    setSemesterForm({ name: semester.name, semester_number: semester.semester_number?.toString() ?? '', status: semester.status, notes: semester.notes ?? '' });
    setError(''); setMessage(''); setSemesterModal(semester.academic_year_id);
  }

  async function saveYear(e: FormEvent) {
    e.preventDefault(); if (!supabase) return;
    const yearLabel = getYearLabel(yearForm.start_year, yearForm.end_year);
    if (!yearLabel) return setError('Enter both a starting year and an ending year.');
    setSaving(true); setError('');
    try {
      const payload = {
        year_label: yearLabel,
        start_year: yearForm.start_year ? Number(yearForm.start_year) : null,
        end_year: yearForm.end_year ? Number(yearForm.end_year) : null,
        sort_order: editingYear?.sort_order ?? years.length
      };
      if (editingYear) {
        const { error } = await supabase.from('academic_years').update(payload).eq('id', editingYear.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Your session has expired. Please sign in again.');
        const { error } = await supabase.from('academic_years').insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
      setYearModal(false); setMessage(editingYear ? 'Academic year updated.' : 'Academic year added.'); await load();
    } catch (err: any) { setError(err.message || 'Could not save the academic year.'); }
    finally { setSaving(false); }
  }

  async function deleteYear(year: AcademicYear) {
    if (!supabase || !confirm(`Delete ${year.year_label}? Its semesters will also be deleted.`)) return;
    setError('');
    const { error } = await supabase.from('academic_years').delete().eq('id', year.id);
    if (error) setError(error.message); else { setMessage('Academic year deleted.'); await load(); }
  }

  async function saveSemester(e: FormEvent) {
    e.preventDefault(); if (!supabase || !semesterModal) return;
    const semesterName = getSemesterName(semesterForm.semester_number);
    if (!semesterName) return setError('Enter a semester number.');
    setSaving(true); setError('');
    try {
      const payload = {
        name: semesterName,
        semester_number: semesterForm.semester_number ? Number(semesterForm.semester_number) : null,
        status: semesterForm.status,
        notes: semesterForm.notes.trim() || null,
        sort_order: editingSemester?.sort_order ?? semesters.filter(s => s.academic_year_id === semesterModal).length
      };
      if (editingSemester) {
        const { error } = await supabase.from('semesters').update(payload).eq('id', editingSemester.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Your session has expired. Please sign in again.');
        const { error } = await supabase.from('semesters').insert({ ...payload, academic_year_id: semesterModal, user_id: user.id });
        if (error) throw error;
      }
      setSemesterModal(null); setMessage(editingSemester ? 'Semester updated.' : 'Semester added.'); await load();
    } catch (err: any) { setError(err.message || 'Could not save the semester.'); }
    finally { setSaving(false); }
  }

  async function deleteSemester(semester: Semester) {
    if (!supabase || !confirm(`Delete ${semester.name}?`)) return;
    setError('');
    const { error } = await supabase.from('semesters').delete().eq('id', semester.id);
    if (error) setError(error.message); else { setMessage('Semester deleted.'); await load(); }
  }

  const semesterMap = useMemo(() => {
    const map: Record<string, Semester[]> = {};
    semesters.forEach(s => { (map[s.academic_year_id] ||= []).push(s); });
    return map;
  }, [semesters]);

  const completed = semesters.filter(s => s.status === 'completed').length;
  const inProgress = semesters.filter(s => s.status === 'in_progress').length;
  const completionPercent = semesters.length ? Math.round(completed / semesters.length * 100) : 0;
  const allExpanded = years.length > 0 && years.every(year => expanded[year.id] ?? true);

  function setAllExpanded(open: boolean) {
    const next: Record<string, boolean> = {};
    years.forEach(year => { next[year.id] = open; });
    setExpanded(next);
  }

  if (!supabase) return <div className="auth-shell"><div className="card" style={{ padding: 28 }}><Logo/><h2>Connect Supabase</h2><p className="muted">Add your Supabase values to .env and restart the dev server.</p></div></div>;
  if (loading) return <div className="auth-shell"><Loader2 className="spin"/><span className="muted">Loading your journey…</span></div>;

  return <div className="app">
    <header className="simple-header"><Link to="/dashboard" className="back-link">← Dashboard</Link><Logo/></header>
    <main className="journey-shell">
      <div className="journey-heading">
        <div><p className="eyebrow">My Journey</p><h1>Your academic timeline</h1><p className="muted">Build your journey year by year and keep every semester organized.</p></div>
        <div className="journey-heading-actions"><div className="journey-view-actions"><button className="btn secondary small-btn" onClick={() => setAllExpanded(true)} disabled={allExpanded}>Expand all</button><button className="btn secondary small-btn" onClick={() => setAllExpanded(false)} disabled={!allExpanded}>Collapse all</button></div><button className="btn primary" onClick={openNewYear}><Plus size={17}/> Add academic year</button></div>
      </div>

      <div className="journey-stats">
        <div className="card journey-stat"><CalendarDays size={20}/><span>Academic years</span><strong>{years.length}</strong></div>
        <div className="card journey-stat"><BookOpen size={20}/><span>Semesters</span><strong>{semesters.length}</strong></div>
        <div className="card journey-stat"><GraduationCap size={20}/><span>Completed</span><strong>{completed}</strong></div>
        <div className="card journey-stat"><RouteIcon size={20}/><span>In progress</span><strong>{inProgress}</strong></div>
      </div>

      <section className="card journey-progress" aria-label="Journey progress">
        <div className="journey-progress-heading"><div><p className="eyebrow">Journey progress</p><h2>{completionPercent}% complete</h2><p className="muted">{completed} of {semesters.length} semester{semesters.length === 1 ? '' : 's'} completed</p></div><GraduationCap size={28}/></div>
        <div className="progress-track"><span style={{ width: `${completionPercent}%` }}/></div>
      </section>

      {(error || message) && <div className={error ? 'error journey-alert' : 'success journey-alert'}>{error || message}</div>}

      {years.length === 0 ? <div className="card journey-empty"><div className="empty-icon"><CalendarDays size={30}/></div><h2>Start your academic journey</h2><p className="muted">Add your first academic year, then place semesters inside it.</p><button className="btn primary" onClick={openNewYear}><Plus size={17}/> Add first academic year</button></div> :
        <div className="timeline">{years.map((year, index) => {
          const yearSemesters = semesterMap[year.id] ?? [];
          const yearCompleted = yearSemesters.filter(semester => semester.status === 'completed').length;
          const yearProgress = yearSemesters.length ? Math.round(yearCompleted / yearSemesters.length * 100) : 0;
          const isOpen = expanded[year.id] ?? true;
          return <section className="timeline-item" key={year.id}>
            <div className="timeline-dot"><CalendarDays size={16}/></div>
            <div className="card year-card">
              <div className="year-top">
                <button className="year-toggle" onClick={() => setExpanded(current => ({ ...current, [year.id]: !isOpen }))} aria-expanded={isOpen}>
                  {isOpen ? <ChevronDown size={19}/> : <ChevronRight size={19}/>}<div><div className="year-label">{year.year_label}</div><div className="muted year-meta">{year.start_year && year.end_year ? `${year.start_year} – ${year.end_year}` : 'Academic year'} · {yearSemesters.length} semester{yearSemesters.length === 1 ? '' : 's'}</div></div>
                </button>
                <div className="row-actions"><button className="icon-btn" onClick={() => openEditYear(year)} aria-label="Edit academic year"><Edit3 size={16}/></button><button className="icon-btn danger-icon" onClick={() => deleteYear(year)} aria-label="Delete academic year"><Trash2 size={16}/></button></div>
              </div>
              {isOpen && <div className="year-body">
                {yearSemesters.length > 0 && <div className="year-progress"><div className="row-between"><span>Year progress</span><strong>{yearProgress}%</strong></div><div className="progress-track"><span style={{ width: `${yearProgress}%` }}/></div></div>}
                {yearSemesters.length === 0 ? <div className="semester-empty"><span>No semesters added yet.</span><button className="btn secondary small-btn" onClick={() => openNewSemester(year.id)}><Plus size={15}/> Add semester</button></div> :
                  <div className="semester-list">{yearSemesters.map((semester) => <article className="semester-card" key={semester.id}>
                    <div className="semester-main"><div className="semester-icon"><BookOpen size={17}/></div><div><h3>{semester.name}</h3><div className="semester-meta">{semester.semester_number ? `Semester ${semester.semester_number}` : 'Semester'} <span>•</span> <StatusBadge status={semester.status}/></div>{semester.notes && <p className="muted semester-notes">{semester.notes}</p>}</div></div>
                    <div className="row-actions"><button className="icon-btn" onClick={() => openEditSemester(semester)} aria-label="Edit semester"><Edit3 size={16}/></button><button className="icon-btn danger-icon" onClick={() => deleteSemester(semester)} aria-label="Delete semester"><Trash2 size={16}/></button></div>
                  </article>)}</div>}
                <button className="add-semester" onClick={() => openNewSemester(year.id)}><Plus size={16}/> Add semester to {year.year_label}</button>
              </div>}
            </div>
            {index < years.length - 1 && <div className="timeline-line"/>}
          </section>;
        })}</div>}
    </main>

    {yearModal && <Modal title={editingYear ? 'Edit academic year' : 'Add academic year'} onClose={() => setYearModal(false)}>
      <form onSubmit={saveYear} className="modal-form"><label className="field"><span>Year label</span><input className="input" value={getYearLabel(yearForm.start_year, yearForm.end_year)} placeholder="Enter start and end years" readOnly/></label><div className="form-grid"><label className="field"><span>Start year *</span><input className="input" type="number" min="1900" max="2200" value={yearForm.start_year} onChange={e => setYearForm({ ...yearForm, start_year: e.target.value })} placeholder="2025" required/></label><label className="field"><span>End year *</span><input className="input" type="number" min="1900" max="2200" value={yearForm.end_year} onChange={e => setYearForm({ ...yearForm, end_year: e.target.value })} placeholder="2026" required/></label></div><div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setYearModal(false)}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? <Loader2 size={16} className="spin"/> : <Save size={16}/>} {editingYear ? 'Save changes' : 'Add year'}</button></div></form>
    </Modal>}

    {semesterModal && <Modal title={editingSemester ? 'Edit semester' : 'Add semester'} onClose={() => setSemesterModal(null)}>
      <form onSubmit={saveSemester} className="modal-form"><label className="field"><span>Semester name</span><input className="input" value={getSemesterName(semesterForm.semester_number)} placeholder="Enter a semester number" readOnly/></label><div className="form-grid"><label className="field"><span>Semester number *</span><input className="input" type="number" min="1" max="12" value={semesterForm.semester_number} onChange={e => setSemesterForm({ ...semesterForm, semester_number: e.target.value })} placeholder="6" required/></label><label className="field"><span>Status</span><select className="input" value={semesterForm.status} onChange={e => setSemesterForm({ ...semesterForm, status: e.target.value as Semester['status'] })}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label></div><label className="field"><span>Notes</span><textarea className="input textarea" rows={4} value={semesterForm.notes} onChange={e => setSemesterForm({ ...semesterForm, notes: e.target.value })} placeholder="Optional notes about this semester…"/></label><div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setSemesterModal(null)}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? <Loader2 size={16} className="spin"/> : <Save size={16}/>} {editingSemester ? 'Save changes' : 'Add semester'}</button></div></form>
    </Modal>}
  </div>;
}

function StatusBadge({ status }: { status: Semester['status'] }) { const label = status === 'in_progress' ? 'In progress' : status[0].toUpperCase() + status.slice(1); return <span className={`status-badge ${status}`}>{label}</span>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-title"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button></div>{children}</div></div>; }
