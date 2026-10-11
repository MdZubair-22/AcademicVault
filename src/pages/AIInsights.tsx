import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BrainCircuit, Search, Sparkles, Copy, FileText, ShieldCheck, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { buildSkillEvidence, findDuplicates, generateAcademicSummary, smartSearch, type AIRecord } from "../lib/aiFeatures";
import Logo from "../components/Logo";

export default function AIInsights() {
  const [records,setRecords]=useState<AIRecord[]>([]);
  const [query,setQuery]=useState("");
  const [period,setPeriod]=useState("all");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [duplicateTitle,setDuplicateTitle]=useState("");
  const [active,setActive]=useState<"search"|"skills"|"summary"|"duplicates">("search");

  async function load(){
    if(!supabase)return;
    setLoading(true); setError("");
    try{
      const [d,c,a,p,i,co] = await Promise.all([
        supabase.from("documents").select("id,title,document_type,institution,document_date,description,tags,ocr_text"),
        supabase.from("certificates").select("id,certificate_title,issuing_organization,issue_date,skills,tags"),
        supabase.from("achievements").select("id,title,organization,achievement_date,tags"),
        supabase.from("projects").select("id,title,description,technologies,tags,start_date"),
        supabase.from("internships").select("id,company,role,description,skills,technologies,tags,start_date"),
        supabase.from("courses").select("id,course_name,platform,skills_learned,tags,completion_date")
      ]);
      const first=[d,c,a,p,i,co].find(x=>x.error);
      if(first?.error) throw first.error;
      const out:AIRecord[]=[];
      (d.data||[]).forEach((r:any)=>out.push({id:r.id,title:r.title,document_type:r.document_type,institution:r.institution,document_date:r.document_date,tags:r.tags,description:r.description,ocr_text:r.ocr_text,source_type:"Academic Record"}));
      (c.data||[]).forEach((r:any)=>out.push({id:r.id,title:r.certificate_title,institution:r.issuing_organization,document_date:r.issue_date,skills:r.skills,tags:r.tags,source_type:"Certificate"}));
      (a.data||[]).forEach((r:any)=>out.push({id:r.id,title:r.title,institution:r.organization,document_date:r.achievement_date,tags:r.tags,source_type:"Achievement"}));
      (p.data||[]).forEach((r:any)=>out.push({id:r.id,title:r.title,description:r.description,skills:r.technologies,tags:r.tags,document_date:r.start_date,source_type:"Project"}));
      (i.data||[]).forEach((r:any)=>out.push({id:r.id,title:r.role||r.company,institution:r.company,description:r.description,skills:[...(r.skills||[]),...(r.technologies||[])],tags:r.tags,document_date:r.start_date,source_type:"Internship"}));
      (co.data||[]).forEach((r:any)=>out.push({id:r.id,title:r.course_name,institution:r.platform,skills:r.skills_learned,tags:r.tags,document_date:r.completion_date,source_type:"Course"}));
      setRecords(out);
    }catch(e:any){setError(e.message||"Could not load AI insights.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{load()},[]);

  const searchResults=useMemo(()=>smartSearch(query,records).slice(0,30),[query,records]);
  const evidence=useMemo(()=>buildSkillEvidence(records),[records]);
  const summary=useMemo(()=>generateAcademicSummary(records,period),[records,period]);
  const duplicates=useMemo(()=>{
    if(!duplicateTitle.trim()) return [];
    const incoming:AIRecord={id:"incoming",title:duplicateTitle,source_type:"Uploaded document"};
    return findDuplicates(incoming,records);
  },[duplicateTitle,records]);
  const periods=useMemo(()=>Array.from(new Set(records.flatMap(r=>[r.academic_year,r.semester].filter(Boolean) as string[]))).sort(),[records]);
  const insightStats = [
    { label: "Indexed records", value: records.length.toString(), detail: "Across your academic vault" },
    { label: "Skills mapped", value: evidence.length.toString(), detail: "Connected to evidence" },
    { label: "Search matches", value: searchResults.length.toString(), detail: "Current query results" },
    { label: "Potential duplicates", value: duplicateTitle.trim() ? duplicates.length.toString() : "0", detail: duplicateTitle.trim() ? "Detected so far" : "Waiting for a title" }
  ];

  return <div className="app">
    <aside className="sidebar"><Logo/><nav className="nav">
      <Link to="/dashboard">Dashboard</Link><Link to="/records">Academic Records</Link><Link className="active" to="/ai-insights"><Sparkles size={16}/> AI Intelligence</Link>
      <Link to="/certificates">Certificates</Link><Link to="/projects">Projects</Link><Link to="/internships">Internships</Link><Link to="/courses">Courses</Link><Link to="/skills">Skills</Link><Link to="/search">Search</Link><Link to="/analytics">Analytics</Link><Link to="/google-drive">Google Drive</Link><Link to="/feedback">Feedback</Link><Link to="/profile">Profile</Link>
    </nav></aside>
    <main className="main">
      <header className="simple-header"><div className="page-header-group"><Link className="back-link" to="/dashboard"><ArrowLeft size={16}/> Dashboard</Link><strong>AI Intelligence</strong></div><button className="btn secondary" onClick={load}><RefreshCw size={15}/> Refresh</button></header>
      <section className="content ai-insights-shell">
        <div className="card ai-hero">
          <div className="ai-hero-copy">
            <div className="ai-hero-icon"><BrainCircuit size={28}/></div>
            <div>
              <p className="eyebrow">AcademicVault AI</p>
              <h1>Academic Intelligence</h1>
              <p className="muted">Classify documents, search naturally, map skills to evidence, summarize academic activity and detect possible duplicates.</p>
            </div>
          </div>
          <div className="ai-hero-stats">
            {insightStats.map(stat => <div key={stat.label} className="ai-mini-stat"><strong>{stat.value}</strong><span>{stat.label}</span><small>{stat.detail}</small></div>)}
          </div>
        </div>
        {error&&<div className="error">{error}</div>}
        <div className="card ai-mode-switch">
          {[
            ["search","AI Smart Search"],["skills","Skill–Evidence Mapping"],["summary","AI Academic Summary"],["duplicates","Duplicate Detection"]
          ].map(([key,label])=><button key={key} className={`ai-mode-btn ${active===key?"active":""}`} onClick={()=>setActive(key as any)}>{label}</button>)}
        </div>
        {loading?<div className="card skeleton-row"/>:
        active==="search"?<section className="card ai-panel">
          <div className="ai-panel-header"><div><p className="eyebrow">Search assistant</p><h2>AI Smart Search</h2></div><span className="status-pill">{searchResults.length} results</span></div>
          <p className="muted">Try: “show my Python certificates”, “find internships related to AI”, or “show my project documents”.</p>
          <div className="search-box ai-search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ask AcademicVault what you want to find…"/></div>
          {!query?<div className="ai-empty-state"><p className="muted">Enter a natural-language request to search your academic evidence.</p><div className="ai-suggestion-row"><span>Python certificates</span><span>AI internship</span><span>Project documents</span></div></div>:
          <div className="records-list ai-results-list">{searchResults.map(r=><article className="card document-card ai-result-card" key={`${r.source_type}-${r.id}`}><div className="doc-icon"><FileText size={22}/></div><div className="doc-main"><div className="doc-top"><h3>{r.title}</h3><span className="file-badge">{r.source_type}</span></div><div className="doc-meta"><span>{r.institution || "Academic content"}</span>{r.source_type && <><span>·</span><span>{r.source_type}</span></>}</div></div></article>)}</div>}
        </section>:
        active==="skills"?<section className="card ai-panel"><div className="ai-panel-header"><div><p className="eyebrow">Skill profile</p><h2>Skill–Evidence Mapping</h2></div><span className="status-pill">{evidence.length} skills</span></div><p className="muted">Each skill is connected to the records that provide evidence for it.</p>{evidence.length?<div className="ai-grid">{evidence.map(x=><article className="card ai-skill-card" key={x.skill}><div className="ai-skill-header"><strong>{x.skill}</strong><span className="status-pill">{x.evidence.length} evidence</span></div><div className="tag-row ai-tag-row">{x.evidence.slice(0,8).map(e=><span key={e.id}><ShieldCheck size={11}/> {e.title}</span>)}</div></article>)}</div>:<p className="muted">Add skills to certificates, projects, internships or courses to build evidence mappings.</p>}</section>:
        active==="summary"?<section className="card ai-panel"><div className="ai-panel-header"><div><p className="eyebrow">Narrative overview</p><h2>AI Academic Summary</h2></div><span className="status-pill">{period === "all" ? "All evidence" : period}</span></div><div className="ai-summary-toolbar"><select className="input compact" value={period} onChange={e=>setPeriod(e.target.value)}><option value="all">All academic evidence</option>{periods.map(x=><option key={x}>{x}</option>)}</select></div><div className="ai-summary-card"><p>{summary.summary}</p>{summary.skills.length>0&&<><strong>Skills identified</strong><div className="tag-row ai-tag-row">{summary.skills.map(s=><span key={s}>{s}</span>)}</div></>}</div></section>:
        <section className="card ai-panel"><div className="ai-panel-header"><div><p className="eyebrow">Quality check</p><h2>Duplicate Document Detection</h2></div><span className="status-pill">{duplicateTitle.trim() ? `${duplicates.length} matches` : "Ready"}</span></div><p className="muted">Enter the title of a new document to check for possible existing matches.</p><div className="search-box ai-search-box"><Copy size={17}/><input value={duplicateTitle} onChange={e=>setDuplicateTitle(e.target.value)} placeholder="e.g. Python Course Certificate"/></div>{duplicateTitle&&<div className="ai-duplicate-list">{duplicates.length?duplicates.map(d=><article className="card ai-duplicate-card" key={d.existingId}><strong>Possible duplicate: {d.existingTitle}</strong><p className="muted">{Math.round(d.similarity*100)}% similarity · {d.reason}</p></article>):<p className="success" style={{marginTop:12}}>No high-similarity existing record was found.</p>}</div>}</section>}
      </section>
    </main>
  </div>;
}
