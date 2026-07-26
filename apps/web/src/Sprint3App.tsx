import { FormEvent, useEffect, useState } from 'react';
import type { DashboardSnapshot, User } from '@northstar/shared';
import { DoctorManagement, PracticeManagement } from './DirectoryManagement';

type View='dashboard'|'practices'|'doctors';
type AuthResponse={user:User};
const sessionKey='northstar.session';
const developmentEmail='dorianhabet@yahoo.com';

function readSession(){try{const value=localStorage.getItem(sessionKey);return value?JSON.parse(value) as User:null}catch{return null}}

export function Sprint3App(){
  const[session,setSession]=useState<User|null>(readSession);
  const[view,setView]=useState<View>('dashboard');
  const[snapshot,setSnapshot]=useState<DashboardSnapshot|null>(null);
  const[revision,setRevision]=useState(0);
  const[error,setError]=useState('');
  useEffect(()=>{if(!session){setSnapshot(null);return}fetch('/api/dashboard').then(async response=>{if(!response.ok)throw new Error();return response.json() as Promise<DashboardSnapshot>}).then(value=>{setSnapshot(value);setError('')}).catch(()=>setError('Dashboard data is temporarily unavailable.'))},[session,revision]);
  const login=(user:User)=>{localStorage.setItem(sessionKey,JSON.stringify(user));setSession(user)};
  const logout=()=>{localStorage.removeItem(sessionKey);setSession(null);setView('dashboard')};
  if(!session)return <Login onLogin={login}/>;
  const title=view==='dashboard'?'Laboratory Status':view==='practices'?'Practice Management':'Doctor Management';
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">NS</span><div><strong>CADence</strong><span>NorthStar</span></div></div><nav><button className={view==='dashboard'?'active':''} onClick={()=>setView('dashboard')}>Laboratory</button><button className={view==='practices'?'active':''} onClick={()=>setView('practices')}>Practices</button><button className={view==='doctors'?'active':''} onClick={()=>setView('doctors')}>Doctors</button></nav><div className="sidebar-footer"><span>Sprint 3 Directory</span><button onClick={logout}>Sign out</button></div></aside><main><header><div><p className="eyebrow">KERAMOS DIGITAL TWIN</p><h1>{title}</h1><p className="subtitle">Authenticated practice and doctor management.</p></div><div className="user-card"><span className="user-avatar">DH</span><div><strong>{session.name}</strong><span>{session.role}</span></div></div></header>{error&&<p className="error" role="alert">{error}</p>}{view==='dashboard'&&<Dashboard snapshot={snapshot}/>} {view==='practices'&&<PracticeManagement onCountsChanged={()=>setRevision(value=>value+1)}/>} {view==='doctors'&&<DoctorManagement onCountsChanged={()=>setRevision(value=>value+1)}/>}</main></div>;
}

function Login({onLogin}:{onLogin:(user:User)=>void}){const[email,setEmail]=useState(developmentEmail);const[password,setPassword]=useState('NorthStar!2026');const[error,setError]=useState('');const[loading,setLoading]=useState(false);const submit=async(event:FormEvent)=>{event.preventDefault();setLoading(true);setError('');try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});if(!response.ok){setError('Incorrect email or password.');return}const payload=await response.json() as AuthResponse;onLogin(payload.user)}catch{setError('Unable to reach the authentication service.')}finally{setLoading(false)}};return <div className="login-page"><form className="login-card" onSubmit={submit}><div className="brand login-brand"><span className="brand-mark">NS</span><div><strong>CADence</strong><span>NorthStar</span></div></div><p className="eyebrow">KERAMOS DIGITAL TWIN</p><h1>Welcome back</h1><p>Sign in to enter the laboratory operating system.</p><label>Email<input value={email} onChange={event=>setEmail(event.target.value)} type="email" autoComplete="username" required/></label><label>Password<input value={password} onChange={event=>setPassword(event.target.value)} type="password" autoComplete="current-password" required/></label>{error&&<p className="error">{error}</p>}<button className="primary" type="submit" disabled={loading}>{loading?'Signing in…':'Sign in'}</button></form></div>}

function Dashboard({snapshot}:{snapshot:DashboardSnapshot|null}){const metrics=[['Active practices',snapshot?.activePractices??0],['Active doctors',snapshot?.activeDoctors??0],['Cases received today',snapshot?.casesReceivedToday??0],['Cases in QC',snapshot?.casesInQc??0]];return <section className="metrics">{metrics.map(([label,value])=><article className="metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>}
