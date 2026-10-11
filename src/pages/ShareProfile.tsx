import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Link2, Loader2, Plus, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';

type Item = { id:string; type:string; title:string; subtitle?:string; date?:string; description?:string; url?:string };
type Profile = { full_name:string; profile_photo_url:string|null; student_id:string|null; college:string|null; university:string|null; degree:string|null; branch:string|null; batch:string|null; current_semester:string|null; linkedin:string|null; github:string|null; portfolio:string|null; bio:string|null };

function label(type:string){return type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function makeToken(){return `${crypto.randomUUID()}-${crypto.randomUUID().replaceAll('-','')}`}

export default function ShareProfile(){
 const [items,setItems]=useState<Item[]>([]),[selected,setSelected]=useState<string[]>([]),[profile,setProfile]=useState<Profile|null>(null);
 const [links,setLinks]=useState<any[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[days,setDays]=useState('7');
 useEffect(()=>{load()},[]);
 async function load(){
  if(!supabase)return;setLoading(true);setError('');
  const {data:{user}}=await supabase.auth.getUser(); if(!user){setError('Please sign in again.');setLoading(false);return;}
  const [p,c,a,pr,i,co,d,l]=await Promise.all([
   supabase.from('student_profiles').select('*').eq('id',user.id).maybeSingle(),
   supabase.from('certificates').select('id,certificate_title,course_name,issuing_organization,issue_date,description').order('created_at',{ascending:false}),
   supabase.from('achievements').select('id,title,organization,achievement_date,description,url').order('created_at',{ascending:false}),
   supabase.from('projects').select('id,title,description,start_date,github_url,live_demo_url').order('created_at',{ascending:false}),
   supabase.from('internships').select('id,company,role,start_date,end_date,description,company_url').order('created_at',{ascending:false}),
   supabase.from('courses').select('id,course_name,platform,completion_date,course_url').order('created_at',{ascending:false}),
   supabase.from('documents').select('id,title,institution,document_date,description').order('created_at',{ascending:false}),
   supabase.from('share_links').select('*').order('created_at',{ascending:false})
  ]);
  const err=[p,c,a,pr,i,co,d,l].find(x=>x.error)?.error; if(err){setError(err.message);setLoading(false);return;}
  setProfile(p.data as Profile|null);
  const next:Item[]=[
   ...(c.data||[]).map(x=>({id:`certificates:${x.id}`,type:'certificates',title:x.certificate_title,subtitle:x.issuing_organization||x.course_name,date:x.issue_date,description:x.description,url:undefined})),
   ...(a.data||[]).map(x=>({id:`achievements:${x.id}`,type:'achievements',title:x.title,subtitle:x.organization,date:x.achievement_date,description:x.description,url:x.url})),
   ...(pr.data||[]).map(x=>({id:`projects:${x.id}`,type:'projects',title:x.title,subtitle:'Project',date:x.start_date,description:x.description,url:x.github_url||x.live_demo_url})),
   ...(i.data||[]).map(x=>({id:`internships:${x.id}`,type:'internships',title:x.company,subtitle:x.role,date:x.start_date,description:x.description,url:x.company_url})),
   ...(co.data||[]).map(x=>({id:`courses:${x.id}`,type:'courses',title:x.course_name,subtitle:x.platform,date:x.completion_date,url:x.course_url})),
   ...(d.data||[]).map(x=>({id:`documents:${x.id}`,type:'documents',title:x.title,subtitle:x.institution,date:x.document_date,description:x.description}))
  ];
  setItems(next);setLinks(l.data||[]);setLoading(false);
 }
 const selectedItems=useMemo(()=>items.filter(x=>selected.includes(x.id)),[items,selected]);
 function toggle(id:string){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id])}
 async function createShare(){
  if(!supabase||!profile)return;if(!selectedItems.length){setError('Select at least one item to share.');return}
  setBusy(true);setError('');setMessage('');
  try{const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Session expired.');const token=makeToken();const expires=new Date(Date.now()+Number(days)*86400000).toISOString();
   const publicProfile={full_name:profile.full_name,profile_photo_url:null,college:profile.college,university:profile.university,degree:profile.degree,branch:profile.branch,batch:profile.batch,current_semester:profile.current_semester,linkedin:profile.linkedin,github:profile.github,portfolio:profile.portfolio,bio:profile.bio};
   const snapshot={profile:publicProfile,items:selectedItems,settings:{allowDownload:false}};
   const {error}=await supabase.from('share_links').insert({user_id:user.id,token,snapshot,expires_at:expires,allow_download:false});if(error)throw error;
   await load();setSelected([]);setMessage('Share profile created.');
  }catch(e:any){setError(e.message||'Could not create share profile.')}finally{setBusy(false)}
 }
 async function revoke(id:string){if(!supabase||!confirm('Revoke this share link? It will stop working immediately.'))return;const {error}=await supabase.from('share_links').update({revoked_at:new Date().toISOString()}).eq('id',id);if(error)setError(error.message);else{setMessage('Share link revoked.');await load()}}
 async function copy(token:string){const url=`${window.location.origin}/share/${token}`;await navigator.clipboard.writeText(url);setMessage('Share link copied.');}
 if(!supabase)return <Connect/>;
 if(loading)return <div className="auth-shell"><Loader2 className="spin"/><span className="muted">Loading sharing tools…</span></div>;
 return <div className="app"><header className="simple-header"><Link to="/dashboard" className="back-link">← Dashboard</Link><Logo/></header><main className="share-shell">
  <div className="share-heading"><div><p className="eyebrow">Private sharing</p><h1>Create a share profile</h1><p className="muted">Choose exactly what another person can see. Your private vault stays private.</p></div><div className="share-security"><ShieldCheck size={19}/><span>Private by default</span></div></div>
  {(error||message)&&<div className={error?'error share-alert':'success share-alert'}>{error||message}</div>}
  <div className="share-grid">
   <section className="card share-builder"><div className="section-title"><div><h2>Select items</h2><p className="muted">{selected.length} selected</p></div><Check size={19}/></div>
    {items.length===0?<div className="share-empty"><Plus size={28}/><h3>Nothing to share yet</h3><p className="muted">Add certificates, projects, achievements or records first.</p></div>:<div className="share-items">{items.map(item=><label className={`share-item ${selected.includes(item.id)?'selected':''}`} key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={()=>toggle(item.id)}/><div className="share-item-icon">{label(item.type).slice(0,1)}</div><div><strong>{item.title}</strong><span>{item.subtitle||label(item.type)}{item.date?` · ${item.date}`:''}</span></div></label>)}</div>}
   </section>
   <section className="card share-settings"><div className="section-title"><div><h2>Share settings</h2><p className="muted">Control how long the link works.</p></div><Link2 size={19}/></div>
    <label className="field"><span>Link expires after</span><select className="input" value={days} onChange={e=>setDays(e.target.value)}><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
    <div className="privacy-note"><ShieldCheck size={17}/><span><strong>Files remain private</strong><small>The shared page exposes selected information only. Private PDF/image files are not made public.</small></span></div>
    <div className="share-preview"><UserRound size={20}/><div><strong>{profile?.full_name||'Your name'}</strong><span>{profile?.degree||'Student'}{profile?.branch?` · ${profile.branch}`:''}</span></div></div>
    <button className="btn primary full-btn" onClick={createShare} disabled={busy||selected.length===0}>{busy?<><Loader2 size={17} className="spin"/> Creating…</>:<><Link2 size={17}/> Generate share link</>}</button>
   </section>
  </div>
  <section className="card share-links"><div className="section-title"><div><h2>Your share links</h2><p className="muted">Revoke a link anytime.</p></div><Link2 size={19}/></div>
   {links.length===0?<p className="muted">No share links created yet.</p>:<div className="share-link-list">{links.map(l=>{const expired=new Date(l.expires_at).getTime()<Date.now();const revoked=!!l.revoked_at;return <div className="share-link-row" key={l.id}><div><strong>{revoked?'Revoked':expired?'Expired':'Active'} share profile</strong><span>Expires {new Date(l.expires_at).toLocaleString()} · {Array.isArray(l.snapshot?.items)?l.snapshot.items.length:0} items</span></div><div className="row-actions"><button className="icon-btn" onClick={()=>copy(l.token)} disabled={revoked||expired} title="Copy link"><Copy size={16}/></button><a className="icon-btn" href={`/share/${l.token}`} target="_blank" rel="noreferrer" title="Open"><Link2 size={16}/></a>{!revoked&&!expired&&<button className="icon-btn danger-icon" onClick={()=>revoke(l.id)} title="Revoke"><Trash2 size={16}/></button>}</div></div>})}</div>}
  </section>
 </main></div>
}

function Connect(){return <div className="auth-shell"><div className="card" style={{padding:28,maxWidth:520}}><Logo/><h2>Connect Supabase</h2><p className="muted">Add your Supabase values to .env and run the sharing database migration.</p></div></div>}

export function PublicShare(){
 const token=window.location.pathname.split('/').filter(Boolean).pop()||'';const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{(async()=>{if(!supabase){setError('Sharing is not configured.');setLoading(false);return}const {data,error}=await supabase.rpc('get_public_share',{share_token:token});if(error||!data){setError(error?.message||'This share link is unavailable, expired, or revoked.')}else setData(data);setLoading(false)})()},[token]);
 if(loading)return <div className="auth-shell"><Loader2 className="spin"/><span className="muted">Opening shared profile…</span></div>;
 if(error)return <div className="auth-shell"><div className="card public-error"><Link to="/login"><Logo/></Link><X size={34}/><h2>Share link unavailable</h2><p className="muted">{error}</p></div></div>;
 const p=data.profile||{};return <div className="public-shell"><header className="public-header"><Link to="/dashboard" className="back-link" aria-label="Back to Dashboard"><ArrowLeft size={18}/> Dashboard</Link><Logo/><span><ShieldCheck size={16}/> Shared AcademicVault profile</span></header><main className="public-main"><section className="card public-hero"><div className="public-avatar"><UserRound size={34}/></div><div><p className="eyebrow">Academic profile</p><h1>{p.full_name||'Student'}</h1><p className="muted">{[p.degree,p.branch,p.college].filter(Boolean).join(' · ')}</p><p>{p.bio}</p><div className="public-links">{p.linkedin&&<a href={p.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}{p.github&&<a href={p.github} target="_blank" rel="noreferrer">GitHub</a>}{p.portfolio&&<a href={p.portfolio} target="_blank" rel="noreferrer">Portfolio</a>}</div></div></section><section className="public-grid">{(data.items||[]).map((x:any)=><article className="card public-item" key={x.id}><div className="share-item-icon">{label(x.type).slice(0,1)}</div><div><span className="public-type">{label(x.type)}</span><h2>{x.title}</h2>{x.subtitle&&<p className="muted">{x.subtitle}</p>}{x.date&&<small>{x.date}</small>}{x.description&&<p>{x.description}</p>}{x.url&&<a className="btn secondary small-btn" href={x.url} target="_blank" rel="noreferrer">Open link</a>}{x.type==='documents'&&<p className="muted public-private-note">Document metadata is shared; the private file remains protected.</p>}</div></article>)}</section></main><footer className="public-footer">Shared through AcademicVault · Private documents remain protected.</footer></div>
}
