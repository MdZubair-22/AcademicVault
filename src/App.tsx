import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useEffect, useRef, useState } from 'react';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Journey from './pages/Journey';
import Documents from './pages/Documents';
import Certificates from './pages/Certificates';
import Achievements from './pages/Achievements';
import Projects from './pages/Projects';
import Internships from './pages/Internships';
import Courses from './pages/Courses';
import Skills from './pages/Skills';
import Search from './pages/Search';
import Analytics from './pages/Analytics';
import ShareProfile, { PublicShare } from './pages/ShareProfile';
import Feedback from './pages/Feedback';
import GoogleDrive from './pages/GoogleDrive';
import Resume from './pages/Resume';
import Settings from './pages/Settings';
import AIInsights from './pages/AIInsights';
import ResetPassword from './pages/ResetPassword';
import { MessageSquare, Cloud, Moon, Sun, Menu, X, LogOut, BarChart3, Route as RouteIcon, FileText, Award, BriefcaseBusiness, BookOpen, Search as SearchIcon, Link2, UserRound, Home, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { supabase } from './lib/supabase';
import Logo from './components/Logo';
import './index.css';

function Guard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setOk(!!data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setOk(!!s); setLoading(false); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (loading) return <div className="auth-shell"><div className="muted">Loading AcademicVault…</div></div>;
  return ok ? children : <Navigate to="/login" replace />;
}

const mobileNav = [
  ['Dashboard','/dashboard',BarChart3], ['My Journey','/journey',RouteIcon],
  ['Academic Records','/records',FileText], ['Certificates','/certificates',Award],
  ['Achievements','/achievements',Award], ['Projects','/projects',BriefcaseBusiness],
  ['Internships','/internships',BriefcaseBusiness], ['Courses','/courses',BookOpen],
  ['Skills','/skills',Award], ['AI Intelligence','/ai-insights',Sparkles], ['Analytics','/analytics',BarChart3],
  ['Search','/search',SearchIcon], ['Resume','/resume',FileText], ['Share Profile','/share',Link2], ['Feedback','/feedback',MessageSquare], ['Google Drive','/google-drive',Cloud], ['Profile','/profile',UserRound], ['Settings','/settings',SettingsIcon],
] as const;

function NavigationGestures() {
  const navigate = useNavigate();
  const location = useLocation();
  const start = useRef<{x:number;y:number;target:EventTarget|null}|null>(null);
  useEffect(() => {
    const isAppPage = !['/login','/register'].includes(location.pathname) && !location.pathname.startsWith('/share/');
    if (!isAppPage) return;
    const onStart = (e: TouchEvent) => {
      const t=e.touches[0];
      if (!t) return;
      start.current={x:t.clientX,y:t.clientY,target:e.target};
    };
    const onEnd = (e: TouchEvent) => {
      const st=start.current; start.current=null;
      const t=e.changedTouches[0];
      if(!st||!t) return;
      if(document.body.classList.contains('drawer-open')) return;
      if((st.target as HTMLElement|null)?.closest('input,textarea,select,button,[data-no-swipe],.modal-backdrop')) return;
      const dx=t.clientX-st.x;
      const dy=Math.abs(t.clientY-st.y);
      const isEdgeSwipe=st.x<=32 && dx>=82 && dy<=100;
      if(isEdgeSwipe && location.pathname!=='/dashboard' && !location.pathname.startsWith('/share/')) {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/dashboard');
        }
      }
    };
    window.addEventListener('touchstart',onStart,{passive:true});
    window.addEventListener('touchend',onEnd,{passive:true});
    return ()=>{window.removeEventListener('touchstart',onStart);window.removeEventListener('touchend',onEnd)};
  },[navigate,location.pathname]);
  return null;
}

function MobileNavigation() {
  const [open,setOpen]=useState(false); const location=useLocation(); const navigate=useNavigate(); const startX=useRef<number|null>(null);
  const isAuthPage=!['/login','/register'].includes(location.pathname)&&!location.pathname.startsWith('/share/');
  useEffect(()=>{setOpen(false)},[location.pathname]);
  useEffect(()=>{
    document.body.classList.toggle('drawer-open', open);
    return ()=>document.body.classList.remove('drawer-open');
  },[open]);
  if(!isAuthPage) return null;
  const close=()=>setOpen(false);
  const showMenuTrigger=true;
  const logout=()=>supabase.auth.signOut().then(()=>navigate('/login'));
  return <>
    {showMenuTrigger&&!open&&<button className="mobile-nav-trigger" onClick={()=>setOpen(true)} aria-label="Open navigation" aria-expanded={open}><Menu size={22}/></button>}
    {open&&<div className="mobile-nav-scrim" onClick={close} aria-hidden="true"/>}
    <aside className={`mobile-drawer ${open?'open':''}`} data-no-swipe onTouchStart={e=>{startX.current=e.touches[0]?.clientX??null}} onTouchEnd={e=>{const x=startX.current;startX.current=null;if(x!==null&&x-e.changedTouches[0].clientX>60)close()}}>
      <div className="mobile-drawer-head"><Logo/><button className="icon-btn" onClick={close} aria-label="Close navigation"><X size={20}/></button></div>
      <div className="mobile-drawer-title">AcademicVault</div>
      <nav className="mobile-drawer-nav">{mobileNav.map(([label,path,Icon])=><Link key={path} to={path} className={location.pathname===path?'active':''} onClick={close}><Icon size={20}/><span>{label}</span></Link>)}<button className="mobile-drawer-logout" onClick={logout}><LogOut size={20}/><span>Logout</span></button></nav>
    </aside>
  </>;
}

function MobileBottomNavigation() {
  const location = useLocation();
  const items = [
    { label: 'Home', path: '/dashboard', Icon: Home },
    { label: 'Search', path: '/search', Icon: SearchIcon },
    { label: 'Analytics', path: '/analytics', Icon: BarChart3 },
    { label: 'Profile', path: '/profile', Icon: UserRound },
  ];
  const hidden = ['/login','/register'].includes(location.pathname) || location.pathname.startsWith('/share/');
  if (hidden) return null;
  return <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
    {items.map(({label,path,Icon}) => <Link key={path} to={path} className={location.pathname===path ? 'active' : ''}>
      <span className="mobile-bottom-icon"><Icon size={22}/></span><span>{label}</span>
    </Link>)}
  </nav>;
}

function ThemeAndFeedbackControls() {
  const [dark,setDark]=useState(()=>localStorage.getItem('academicvault_theme')!=='light'); const location=useLocation();
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('academicvault_theme',dark?'dark':'light')},[dark]);
  return <>
    {location.pathname==='/dashboard'&&<button className="theme-fab" onClick={()=>setDark(v=>!v)} aria-label="Toggle dark mode" title="Toggle dark mode">{dark?<Sun size={17}/>:<Moon size={17}/>}</button>}
  </>;
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!('Capacitor' in window)) return;

    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }

      if (location.pathname === '/dashboard') {
        return;
      }

      navigate('/dashboard');
    });

    return () => {
      listener.then((subscription) => subscription.remove());
    };
  }, [location.pathname, navigate]);

  return <>
    <NavigationGestures/>
    <MobileNavigation/>
    <MobileBottomNavigation/>
    <ThemeAndFeedbackControls/>
    <Routes>
      <Route path="/login" element={<Auth mode="login"/>}/>
      <Route path="/register" element={<Auth mode="register"/>}/>
      <Route path="/reset-password" element={<ResetPassword/>}/>
      <Route path="/dashboard" element={<Guard><Dashboard/></Guard>}/>
      <Route path="/profile" element={<Guard><Profile/></Guard>}/>
      <Route path="/profile/setup" element={<Guard><Profile setup/></Guard>}/>
      <Route path="/settings" element={<Guard><Settings/></Guard>}/>
      <Route path="/journey" element={<Guard><Journey/></Guard>}/>
      <Route path="/records" element={<Guard><Documents/></Guard>}/>
      <Route path="/certificates" element={<Guard><Certificates/></Guard>}/>
      <Route path="/achievements" element={<Guard><Achievements/></Guard>}/>
      <Route path="/projects" element={<Guard><Projects/></Guard>}/>
      <Route path="/internships" element={<Guard><Internships/></Guard>}/>
      <Route path="/courses" element={<Guard><Courses/></Guard>}/>
      <Route path="/skills" element={<Guard><Skills/></Guard>}/>
      <Route path="/search" element={<Guard><Search/></Guard>}/>
      <Route path="/analytics" element={<Guard><Analytics/></Guard>}/>
      <Route path="/ai-insights" element={<Guard><AIInsights/></Guard>}/>
      <Route path="/share" element={<Guard><ShareProfile/></Guard>}/>
      <Route path="/feedback" element={<Guard><Feedback/></Guard>}/>
      <Route path="/google-drive" element={<Guard><GoogleDrive/></Guard>}/>
      <Route path="/resume" element={<Guard><Resume/></Guard>}/>
      <Route path="/share/:token" element={<PublicShare/>}/>
      <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
    </Routes>
  </>;
}

export default function App() {
  return <BrowserRouter><AppShell/></BrowserRouter>;
}
