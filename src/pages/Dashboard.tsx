import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Award, ArrowUpRight, BarChart3, Cloud, Sparkles, BookOpen, BriefcaseBusiness, CalendarDays, FileText, FileText as ResumeIcon, LogOut, Route as RouteIcon, UserRound, Search as SearchIcon, Link2, MessageSquare, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

type Profile = { full_name: string; profile_photo_url: string | null; student_id: string | null; college: string | null; university: string | null; degree: string | null; branch: string | null; batch: string | null; current_semester: string | null; email: string | null };

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [completion, setCompletion] = useState(0);
  const [years, setYears] = useState(0);
  const [semesters, setSemesters] = useState(0);
  const [completedSemesters, setCompletedSemesters] = useState(0);
  const [inProgressSemesters, setInProgressSemesters] = useState(0);
  const [documents, setDocuments] = useState(0);
  const [certificates, setCertificates] = useState(0);
  const [achievements, setAchievements] = useState(0);
  const [projects, setProjects] = useState(0);
  const [internships, setInternships] = useState(0);
  const [courses, setCourses] = useState(0);
  const [skills, setSkills] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (!user) { setLoading(false); return; }
    const [{ data: profileData }, { count: yearCount }, { count: semesterCount }, { count: completedCount }, { count: progressCount }, { count: documentCount }, { count: certificateCount }, { count: achievementCount }, { count: projectCount }, { count: internshipCount }, { count: courseCount }, { count: skillCount }] = await Promise.all([
      supabase.from('student_profiles').select('full_name,profile_photo_url,student_id,college,university,degree,branch,batch,current_semester,email,linkedin,github,portfolio,bio').eq('id', user.id).maybeSingle(),
      supabase.from('academic_years').select('*', { count: 'exact', head: true }),
      supabase.from('semesters').select('*', { count: 'exact', head: true }),
      supabase.from('semesters').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('semesters').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('documents').select('*', { count: 'exact', head: true }),
      supabase.from('certificates').select('*', { count: 'exact', head: true }),
      supabase.from('achievements').select('*', { count: 'exact', head: true }),
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      supabase.from('internships').select('*', { count: 'exact', head: true }),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('skills').select('*', { count: 'exact', head: true })
    ]);
    setProfile(profileData as Profile | null);
    setYears(yearCount ?? 0); setSemesters(semesterCount ?? 0); setCompletedSemesters(completedCount ?? 0); setInProgressSemesters(progressCount ?? 0); setDocuments(documentCount ?? 0); setCertificates(certificateCount ?? 0); setAchievements(achievementCount ?? 0); setProjects(projectCount ?? 0); setInternships(internshipCount ?? 0); setCourses(courseCount ?? 0); setSkills(skillCount ?? 0);
    const all = profileData as Record<string, unknown> | null;
    if (all) {
      const fields = ['full_name','profile_photo_url','student_id','college','university','degree','branch','batch','current_semester','linkedin','github','portfolio','bio'];
      setCompletion(Math.round(fields.filter(f => Boolean(String(all[f] ?? '').trim())).length / fields.length * 100));
    }
    setLoading(false);
  }

  async function logout() { await supabase?.auth.signOut(); location.href = '/login'; }
  const firstName = [profile?.full_name, user?.user_metadata?.full_name]
    .map(name => typeof name === 'string' ? name.trim() : '')
    .find(name => name && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name)) || 'Student';
  const greeting = getTimeGreeting();
  const evidenceItems = documents + certificates + achievements + projects + internships + courses + skills;
  const implementedNav = [['Dashboard','/dashboard',BarChart3], ['My Journey','/journey',RouteIcon], ['Academic Records','/records',FileText], ['Certificates','/certificates',Award], ['Achievements','/achievements',Award], ['Projects','/projects',BriefcaseBusiness], ['Internships','/internships',BriefcaseBusiness], ['Courses','/courses',BookOpen], ['Skills','/skills',Award], ['AI Intelligence','/ai-insights',Sparkles], ['Analytics','/analytics',BarChart3], ['Google Drive','/google-drive',Cloud], ['Resume','/resume',ResumeIcon], ['Search','/search',SearchIcon], ['Share Profile','/share',Link2], ['Feedback','/feedback',MessageSquare], ['Profile','/profile',UserRound], ['Settings','/settings',Settings]] as const;

  if (loading) return <div className="auth-shell"><div className="muted">Loading AcademicVault…</div></div>;

  return <div className="app">
    <aside className="sidebar">
      <Logo />
      <nav className="nav">{implementedNav.map(([label, path, Icon]) => <NavLink key={label} to={path} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={17}/>{label}</NavLink>)}</nav>
      <div className="sidebar-bottom"><Link to="/profile" className="profile-mini"><UserRound size={17}/><span>Profile</span></Link><button className="btn" style={{ background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={logout}><LogOut size={17}/> Logout</button></div>
    </aside>
    <main className="main">
      <header className="header"><div><strong>Dashboard</strong><div className="muted" style={{ fontSize: 12 }}>AcademicVault</div></div><span className="email">{user?.email}</span></header>
      <section className="content">
        <div className="dashboard-hero"><div><p className="dashboard-hero-kicker">YOUR ACADEMIC SPACE</p><h1 style={{ margin: '0 0 6px' }}>{greeting}, {firstName} 👋</h1><p className="muted">Your academic journey, organized in one place.</p></div><Link to="/profile" className="btn secondary"><UserRound size={17}/> {completion}% profile <ArrowUpRight size={15}/></Link></div>
        {completion < 100 && <div className="profile-banner card"><div><strong>Complete your student profile</strong><p className="muted">Add your academic details now so AcademicVault can organize your journey around you.</p><div className="progress"><span style={{ width: `${completion}%` }}/></div></div><Link className="btn primary" to="/profile">Complete profile</Link></div>}

        <div className="dashboard-section-heading">
          <div><p className="eyebrow">AT A GLANCE</p><h2>Your academic snapshot</h2></div>
          <span className="dashboard-total-pill">{evidenceItems} vault entries</span>
        </div>
        <div className="grid phase3-grid">
          <Link to="/records" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}><FileText size={21} color="#4338ca"/><div className="muted" style={{ marginTop: 12 }}>Academic Records</div><div className="num">{documents}</div></Link>
          <Link to="/certificates" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}><Award size={21} color="#4338ca"/><div className="muted" style={{ marginTop: 12 }}>Certificates</div><div className="num">{certificates}</div></Link>
          <Link to="/achievements" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}><Award size={21} color="#4338ca"/><div className="muted" style={{ marginTop: 12 }}>Achievements</div><div className="num">{achievements}</div></Link>
          <Link to="/projects" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}><BriefcaseBusiness size={21} color="#4338ca"/><div className="muted" style={{ marginTop: 12 }}>Projects</div><div className="num">{projects}</div></Link>
          <Link to="/journey" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}><CalendarDays size={21} color="#4338ca"/><div className="muted" style={{ marginTop: 12 }}>Academic Years</div><div className="num">{years}</div></Link>
          <Link to="/journey" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}><BookOpen size={21} color="#4338ca"/><div className="muted" style={{ marginTop: 12 }}>Semesters</div><div className="num">{semesters}</div></Link>
          <Link to="/journey" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}><BarChart3 size={21} color="#4338ca"/><div className="muted" style={{ marginTop: 12 }}>Completed</div><div className="num">{completedSemesters}</div></Link>
          <Link to="/journey" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}><RouteIcon size={21} color="#4338ca"/><div className="muted" style={{ marginTop: 12 }}>In progress</div><div className="num">{inProgressSemesters}</div></Link>
          <Link to="/internships" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}><BriefcaseBusiness size={21} color="#4338ca"/><div className="muted" style={{ marginTop: 12 }}>Internships</div><div className="num">{internships}</div></Link>
          <Link to="/courses" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}><BookOpen size={21} color="#4338ca"/><div className="muted" style={{ marginTop: 12 }}>Courses</div><div className="num">{courses}</div></Link>
          <Link to="/skills" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}><Award size={21} color="#4338ca"/><div className="muted" style={{ marginTop: 12 }}>Skills</div><div className="num">{skills}</div></Link>
        </div>

        <div className="dashboard-section-heading dashboard-shortcuts-heading">
          <div><p className="eyebrow">GET MORE DONE</p><h2>Quick access</h2></div>
          <span className="muted">Your most-used tools, all in one place</span>
        </div>
        <div className="quick-links-row">
          <Link to="/share" className="card quick-link"><span className="quick-link-icon"><Link2 size={19}/></span><div><strong>Share your profile</strong><span className="muted">Choose what others can see.</span></div><ArrowUpRight className="quick-link-arrow" size={17}/></Link>
          <Link to="/search" className="card quick-link"><span className="quick-link-icon"><SearchIcon size={19}/></span><div><strong>Search your vault</strong><span className="muted">Find any academic item instantly.</span></div><ArrowUpRight className="quick-link-arrow" size={17}/></Link>
          <Link to="/analytics" className="card quick-link"><span className="quick-link-icon"><BarChart3 size={19}/></span><div><strong>View analytics</strong><span className="muted">See real progress and evidence.</span></div><ArrowUpRight className="quick-link-arrow" size={17}/></Link>
          <Link to="/ai-insights" className="card quick-link"><span className="quick-link-icon"><Sparkles size={19}/></span><div><strong>AI Intelligence</strong><span className="muted">Search, skills, summaries and duplicates.</span></div><ArrowUpRight className="quick-link-arrow" size={17}/></Link>
          <Link to="/resume" className="card quick-link"><span className="quick-link-icon"><ResumeIcon size={19}/></span><div><strong>Build your resume</strong><span className="muted">Turn your vault into a polished PDF.</span></div><ArrowUpRight className="quick-link-arrow" size={17}/></Link>
        </div>
        <div className="journey-overview card"><div><p className="eyebrow">YOUR NEXT STEP</p><h2 style={{ margin: 0 }}>Build your academic timeline</h2><p className="muted">Create academic years and place semesters inside them. Certificates, achievements and projects are now part of your academic journey. Link them to a year and semester when you add them.</p></div><Link to="/journey" className="btn primary"><RouteIcon size={17}/> Open My Journey</Link></div>

        <div className="card next-phase-card"><div><p className="eyebrow">PRIVATE BY DESIGN</p><h2 style={{ margin: 0 }}>Secure academic records</h2><p className="muted">Upload private marksheets, grade cards, transcripts and academic documents. Files stay protected in your vault.</p></div><Link to="/records" className="btn primary">Open Academic Records <ArrowUpRight size={16}/></Link></div>
      </section>
    </main>
  </div>;
}
