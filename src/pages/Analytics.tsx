import { useEffect, useState } from 'react';
import { Award, BarChart3, BookOpen, BriefcaseBusiness, CalendarDays, FileText, RefreshCw, Target, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

type Counts={records:number;certificates:number;achievements:number;projects:number;internships:number;courses:number;skills:number;years:number;semesters:number};
function BarChart({data}:{data:{label:string;value:number}[]}){const max=Math.max(1,...data.map(x=>x.value));return <div className="bar-chart">{data.map(x=><div className="bar-row" key={x.label}><span>{x.label}</span><div className="bar-track"><i style={{width:`${x.value/max*100}%`}}/></div><strong>{x.value}</strong></div>)} </div>}
export default function Analytics(){
 const [counts,setCounts]=useState<Counts>({records:0,certificates:0,achievements:0,projects:0,internships:0,courses:0,skills:0,years:0,semesters:0});
 const [semesterData,setSemesterData]=useState<{label:string;value:number}[]>([]); const [certificateYearData,setCertificateYearData]=useState<{label:string;value:number}[]>([]); const [achievementYearData,setAchievementYearData]=useState<{label:string;value:number}[]>([]); const [projectTechData,setProjectTechData]=useState<{label:string;value:number}[]>([]); const [skillEvidenceData,setSkillEvidenceData]=useState<{label:string;value:number}[]>([]); const [courseStatusData,setCourseStatusData]=useState<{label:string;value:number}[]>([]); const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false); const [error,setError]=useState('');
 useEffect(()=>{load()},[]);
 async function load() {
  if(!supabase)return; setLoading(true); setRefreshing(true); setError('');
  const [d,c,a,p,i,co,sk,y,se]=await Promise.all([
   supabase.from('documents').select('semester_id,document_date,created_at'),
   supabase.from('certificates').select('issue_date,created_at,skills'),
   supabase.from('achievements').select('achievement_date,created_at'),
   supabase.from('projects').select('technologies'),
   supabase.from('internships').select('skills,technologies'),
   supabase.from('courses').select('status,skills_learned'),
   supabase.from('skills').select('id'),
   supabase.from('academic_years').select('id,year_label,start_year').order('start_year'),
   supabase.from('semesters').select('id,name,semester_number,status').order('semester_number')
  ]);
  const rs=[d,c,a,p,i,co,sk,y,se]; const err=rs.find(x=>x.error); if(err?.error){setError(err.error.message);setLoading(false);setRefreshing(false);return}
  setCounts({records:d.data?.length??0,certificates:c.data?.length??0,achievements:a.data?.length??0,projects:p.data?.length??0,internships:i.data?.length??0,courses:co.data?.length??0,skills:sk.data?.length??0,years:y.data?.length??0,semesters:se.data?.length??0});
  const semesterMap = new Map<string, string>(
    (se.data ?? []).map((x: any) => [String(x.id), String(x.name)])
  ); const semesterCounts = new Map<string, number>();
  (d.data ?? []).forEach((r: any) => {
    const label = semesterMap.get(String(r.semester_id ?? '')) ?? 'Unlinked';
    semesterCounts.set(label, (semesterCounts.get(label) ?? 0) + 1);
  }); setSemesterData([...semesterCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value})));
  const yearCounts=(rows:any[],field:string)=>{const m=new Map<string,number>(); rows.forEach(r=>{const date=r[field]||r.created_at; if(!date)return; const yr=new Date(date).getFullYear().toString();m.set(yr,(m.get(yr)||0)+1)});return [...m.entries()].sort((a,b)=>Number(a[0])-Number(b[0])).map(([label,value])=>({label,value}))};
  setCertificateYearData(yearCounts(c.data??[],'issue_date')); setAchievementYearData(yearCounts(a.data??[],'achievement_date'));
  const tech=new Map<string,number>(); (p.data??[]).forEach(r=>(r.technologies||[]).forEach((v:string)=>{const n=v.trim();if(n)tech.set(n,(tech.get(n)||0)+1)})); setProjectTechData([...tech.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label,value])=>({label,value})));
  const evidence=new Map<string,number>(); const bump=(rows:any[],field:string)=>rows.forEach(r=>(r[field]||[]).forEach((v:string)=>{const n=v.trim();if(n)evidence.set(n,(evidence.get(n)||0)+1)})); bump(c.data??[],'skills'); bump(p.data??[],'technologies'); bump(i.data??[],'skills'); bump(i.data??[],'technologies'); bump(co.data??[],'skills_learned'); setSkillEvidenceData([...evidence.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label,value])=>({label,value})));
  const status=new Map<string,number>(); (co.data??[]).forEach(r=>status.set(r.status,(status.get(r.status)||0)+1)); setCourseStatusData([...status.entries()].map(([label,value])=>({label:label.replace('_',' '),value})));
  setLoading(false); setRefreshing(false);
 }
 const collection=[['Records',counts.records,FileText,'/records'],['Certificates',counts.certificates,Award,'/certificates'],['Achievements',counts.achievements,Award,'/achievements'],['Projects',counts.projects,BriefcaseBusiness,'/projects'],['Internships',counts.internships,BriefcaseBusiness,'/internships'],['Courses',counts.courses,BookOpen,'/courses'],['Skills',counts.skills,Award,'/skills']];
 const totalEvidence=counts.records+counts.certificates+counts.achievements+counts.projects+counts.internships+counts.courses;
 const completedCourses=courseStatusData.find(item=>item.label.toLowerCase()==='completed')?.value??0;
 const linkedRecords=semesterData.filter(item=>item.label!=='Unlinked').reduce((sum,item)=>sum+item.value,0);
 const recordCoverage=counts.records?Math.min(100,Math.round(linkedRecords/counts.records*100)):0;
 const strongestSignal=skillEvidenceData[0]?.label||'Build your first signal';
 return <div className="app"><aside className="sidebar"><Logo/><nav className="nav">{[['Dashboard','/dashboard'],['My Journey','/journey'],['Academic Records','/records'],['Certificates','/certificates'],['Achievements','/achievements'],['Projects','/projects'],['Internships','/internships'],['Courses','/courses'],['Skills','/skills'],['Analytics','/analytics'],['Search','/search'],['Feedback','/feedback'],['Profile','/profile']].map(([n,p])=><Link key={n} className={n==='Analytics'?'active':''} to={p}>{n}</Link>)}</nav></aside><main className="main"><header className="simple-header"><div className="page-header-group"><Link className="back-link" to="/dashboard">← Dashboard</Link><strong>Analytics</strong></div><button className="btn analytics-refresh" onClick={load} disabled={refreshing}><RefreshCw size={16} className={refreshing?'spin':''}/>{refreshing?'Updating':'Refresh'}</button></header><section className="analytics-shell"><div className="analytics-heading"><div><p className="eyebrow">Your data, visualized</p><h1>Academic analytics</h1><p className="muted">A live view of your academic evidence, momentum, and coverage.</p></div><div className="analytics-heading-mark"><TrendingUp size={24}/><span>Live insight</span></div></div>{error&&<div className="error">{error}</div>}{loading?<div className="analytics-grid"><div className="card skeleton-row"/><div className="card skeleton-row"/><div className="card skeleton-row"/></div>:<><div className="analytics-overview"><div className="card analytics-focus"><Target size={21}/><div><small>Total evidence</small><strong>{totalEvidence}</strong><span>Items across your vault</span></div></div><div className="card analytics-focus"><TrendingUp size={21}/><div><small>Learning progress</small><strong>{completedCourses}/{counts.courses}</strong><span>Courses completed</span></div></div><div className="card analytics-focus"><Target size={21}/><div><small>Portfolio signal</small><strong>{strongestSignal}</strong><span>Most repeated skill evidence</span></div></div><div className="card analytics-focus"><FileText size={21}/><div><small>Record coverage</small><strong>{recordCoverage}%</strong><span>Documents linked to semesters</span></div></div></div><div className="analytics-stats">{collection.map(([label, value, Icon, path]: any[]) => {
  const I = Icon as any;
  return (
    <Link className="card analytics-stat" key={String(label)} to={String(path)}>
      <I size={20} />
      <span>{String(label)}</span>
      <strong>{Number(value)}</strong>
    </Link>
  );
})}</div><div className="analytics-grid"><section className="card chart-card"><div className="section-title"><div><h2>Academic records per semester</h2><p className="muted">Real document counts grouped by linked semester.</p></div><FileText size={20}/></div>{semesterData.length?<BarChart data={semesterData}/>:<div className="chart-empty">Add academic records and link them to semesters to see this chart.</div>}</section><section className="card chart-card"><div className="section-title"><div><h2>Certificates by year</h2><p className="muted">Certificate issue dates from your saved records.</p></div><Award size={20}/></div>{certificateYearData.length?<BarChart data={certificateYearData}/>:<div className="chart-empty">Add certificates with issue dates to see yearly activity.</div>}</section><section className="card chart-card"><div className="section-title"><div><h2>Achievements by year</h2><p className="muted">Achievement dates from your saved records.</p></div><Award size={20}/></div>{achievementYearData.length?<BarChart data={achievementYearData}/>:<div className="chart-empty">Add achievements with dates to see yearly activity.</div>}</section><section className="card chart-card"><div className="section-title"><div><h2>Projects by technology</h2><p className="muted">Technology evidence frequency across projects.</p></div><BriefcaseBusiness size={20}/></div>{projectTechData.length?<BarChart data={projectTechData}/>:<div className="chart-empty">Add technologies to projects to see evidence.</div>}</section><section className="card chart-card"><div className="section-title"><div><h2>Skill evidence</h2><p className="muted">Frequency of skills/technologies across certificates, projects, internships and courses.</p></div><BarChart3 size={20}/></div>{skillEvidenceData.length?<BarChart data={skillEvidenceData}/>:<div className="chart-empty">Add skills to your portfolio items to see evidence.</div>}</section><section className="card chart-card"><div className="section-title"><div><h2>Course status</h2><p className="muted">Current planned, in-progress and completed courses.</p></div><BookOpen size={20}/></div>{courseStatusData.length?<BarChart data={courseStatusData}/>:<div className="chart-empty">Add courses to see status distribution.</div>}</section></div></>}</section></main></div>
}
