import { useEffect, useMemo, useState } from 'react';

type ModuleKey='NORTHSTAR_CORE'|'DESIGN_STUDIO'|'GVM';
type TenantStatus='TRIAL'|'ACTIVE'|'SUSPENDED'|'CANCELLED';
type ActivationState='PENDING'|'ACTIVATED'|'DEACTIVATED';

type Tenant={
  id:string;
  name:string;
  status:TenantStatus;
  activationState:ActivationState;
  commercialAccountReference:string|null;
  commercialActivatedAt:string|null;
  commercialSuspendedAt:string|null;
  commercialCancelledAt:string|null;
  createdAt:string;
};
type Entitlement={moduleKey:ModuleKey;state:'ACTIVE'|'DISABLED';effectiveFrom:string|null;effectiveUntil:string|null};
type SeatPool={moduleKey:ModuleKey;purchasedSeatCount:number;assignedSeatCount:number;availableSeatCount:number};
type Credential={id:string;issuedAt:string;expiresAt:string;activatedAt:string|null;revokedAt:string|null;revocationReason:string|null;supersedesCredentialId:string|null;replacedByCredentialId:string|null};
type AuditEvent={actorName:string;action:string;entityId:string;occurredAt:string;metadata:Record<string,unknown>};
type DirectoryRow={tenant:Tenant;entitlements:Entitlement[];seatPools:SeatPool[]};
type Detail={tenant:Tenant;credentials:Credential[];entitlements:Entitlement[];seatPools:SeatPool[];audit:AuditEvent[]};
type OneTimeSecret={credential:string;credentialId:string;tenantName:string};

const modules:ModuleKey[]=['NORTHSTAR_CORE','DESIGN_STUDIO','GVM'];
const seatModules:ModuleKey[]=['NORTHSTAR_CORE','DESIGN_STUDIO'];

async function responseBody(response:Response){
  const value=await response.json().catch(()=>null) as Record<string,unknown>|null;
  if(!response.ok)throw new Error(typeof value?.error==='string'?value.error:'Commercial request could not be completed.');
  return value;
}
const date=(value:string|null)=>value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
const stateClass=(value:string)=>`commercial-state commercial-state-${value.toLowerCase()}`;
const entitlementFor=(rows:Entitlement[],key:ModuleKey)=>rows.find(row=>row.moduleKey===key)??null;
const poolFor=(rows:SeatPool[],key:ModuleKey)=>rows.find(row=>row.moduleKey===key)??null;
const reasonFrom=(metadata:Record<string,unknown>)=>typeof metadata.reason==='string'?metadata.reason:'';
function resultingState(metadata:Record<string,unknown>){
  const value=metadata.newState;
  if(!value||typeof value!=='object'||Array.isArray(value))return 'Recorded';
  const state=value as Record<string,unknown>;
  if(typeof state.status==='string'||typeof state.activationState==='string')return [state.status,state.activationState].filter(Boolean).join(' · ');
  if(typeof state.state==='string')return state.state;
  if(typeof state.purchasedSeatCount==='number')return `${state.purchasedSeatCount} purchased seats`;
  return 'Recorded';
}

export function PlatformCommercialConsole(){
  const [rows,setRows]=useState<DirectoryRow[]>([]);
  const [directoryLoading,setDirectoryLoading]=useState(true);
  const [directoryError,setDirectoryError]=useState('');
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState<'all'|TenantStatus>('all');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [detailError,setDetailError]=useState('');
  const [pending,setPending]=useState<string|null>(null);
  const [reason,setReason]=useState('');
  const [seatDrafts,setSeatDrafts]=useState<Partial<Record<ModuleKey,string>>>({});
  const [secret,setSecret]=useState<OneTimeSecret|null>(null);
  const [feedback,setFeedback]=useState('');

  const loadDirectory=async()=>{
    setDirectoryLoading(true);setDirectoryError('');
    try{
      const response=await fetch('/api/commercial/tenants');
      const value=await responseBody(response) as unknown as DirectoryRow[];
      setRows(value);
    }catch(error){setDirectoryError(error instanceof Error?error.message:'Commercial directory is unavailable.');}
    finally{setDirectoryLoading(false);}
  };
  useEffect(()=>{void loadDirectory();},[]);

  const loadDetail=async(tenantId:string)=>{
    setDetailLoading(true);setDetailError('');
    try{
      const [inspection,entitlements,seats,audit]=await Promise.all([
        fetch(`/api/commercial/tenants/${tenantId}`).then(responseBody),
        fetch(`/api/commercial/tenants/${tenantId}/entitlements`).then(responseBody),
        fetch(`/api/commercial/tenants/${tenantId}/seat-pools`).then(responseBody),
        fetch(`/api/commercial/tenants/${tenantId}/audit`).then(responseBody)
      ]);
      const next={...(inspection as unknown as {tenant:Tenant;credentials:Credential[]}),entitlements:entitlements as unknown as Entitlement[],seatPools:seats as unknown as SeatPool[],audit:audit as unknown as AuditEvent[]};
      setDetail(next);
      setSeatDrafts(Object.fromEntries(seatModules.map(key=>[key,String(poolFor(next.seatPools,key)?.purchasedSeatCount??0)])) as Partial<Record<ModuleKey,string>>);
    }catch(error){setDetail(null);setDetailError(error instanceof Error?error.message:'Commercial account detail is unavailable.');}
    finally{setDetailLoading(false);}
  };
  useEffect(()=>{if(selectedId){void loadDetail(selectedId);}else{setDetail(null);setDetailError('');}},[selectedId]);
  useEffect(()=>()=>setSecret(null),[]);

  const filtered=useMemo(()=>rows.filter(row=>{
    const haystack=[row.tenant.name,row.tenant.id,row.tenant.commercialAccountReference??''].join(' ').toLowerCase();
    return (status==='all'||row.tenant.status===status)&&haystack.includes(query.trim().toLowerCase());
  }),[rows,query,status]);
  const choose=(tenantId:string)=>{setSecret(null);setFeedback('');setSelectedId(tenantId);};
  const refresh=async()=>{await Promise.all([loadDirectory(),selectedId?loadDetail(selectedId):Promise.resolve()]);};
  const run=async(key:string,work:()=>Promise<void>)=>{setPending(key);setFeedback('');try{await work();await refresh();}catch(error){setFeedback(error instanceof Error?error.message:'Commercial request could not be completed.');}finally{setPending(null);}};
  const mutation=async(path:string,method:'POST'|'PUT',body:Record<string,unknown>)=>responseBody(await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));

  const issue=()=>{if(!detail)return;void run('issue',async()=>{const value=await mutation(`/api/commercial/tenants/${detail.tenant.id}/activation-credentials`,'POST',{reason:reason.trim()||undefined}) as unknown as {credential:string;record:Credential};setSecret({credential:value.credential,credentialId:value.record.id,tenantName:detail.tenant.name});setReason('');setFeedback('Activation credential issued. Copy it now; it will not be shown again.');});};
  const credentialAction=(credential:Credential,action:'revoke'|'rotate')=>{if(!detail)return;const label=action==='rotate'?'rotate and replace':'revoke';if(!window.confirm(`Confirm ${label} for this activation credential?`))return;void run(`${action}-${credential.id}`,async()=>{const value=await mutation(`/api/commercial/tenants/${detail.tenant.id}/activation-credentials/${credential.id}/${action}`,'POST',{reason:reason.trim()||undefined}) as unknown as {credential?:string;record?:Credential};if(action==='rotate'&&value.credential&&value.record)setSecret({credential:value.credential,credentialId:value.record.id,tenantName:detail.tenant.name});setReason('');setFeedback(action==='rotate'?'Credential rotated. Copy the replacement now; it will not be shown again.':'Credential revoked.');});};
  const changeEntitlement=(key:ModuleKey,next:'ACTIVE'|'DISABLED')=>{if(!detail)return;const verb=next==='ACTIVE'?'enable':'disable';if(!window.confirm(`Confirm ${verb} ${key} for ${detail.tenant.name}?`))return;void run(`entitlement-${key}`,async()=>{await mutation(`/api/commercial/tenants/${detail.tenant.id}/entitlements/${key}`,'PUT',{state:next});setFeedback(`${key} is now ${next.toLowerCase()}.`);});};
  const saveSeat=(key:ModuleKey)=>{if(!detail)return;const amount=Number(seatDrafts[key]);const assigned=poolFor(detail.seatPools,key)?.assignedSeatCount??0;if(!Number.isSafeInteger(amount)||amount<assigned){setFeedback(`Seat limit must be a whole number and cannot be below ${assigned} assigned seats.`);return;}void run(`seat-${key}`,async()=>{await mutation(`/api/commercial/tenants/${detail.tenant.id}/seat-pools/${key}`,'PUT',{purchasedSeatCount:amount});setFeedback(`${key} seat limit saved from the commercial control plane.`);});};
  const lifecycle=(action:'suspend'|'reactivate'|'cancel')=>{if(!detail)return;const why=reason.trim();if(!why){setFeedback('A reason is required for this lifecycle action.');return;}const wording=action==='cancel'?'Cancellation preserves historical data but ends commercial access.':action==='suspend'?'Suspension blocks tenant operational access while preserving data.':'Reactivation restores access only where valid memberships, entitlements, and seats already exist.';if(!window.confirm(`${wording}\n\nConfirm ${action} for ${detail.tenant.name}?`))return;void run(`lifecycle-${action}`,async()=>{await mutation(`/api/commercial/tenants/${detail.tenant.id}/${action}`,'POST',{reason:why});setReason('');setFeedback(`Laboratory ${action} confirmed by the server.`);});};
  const copySecret=async()=>{if(!secret)return;try{await navigator.clipboard.writeText(secret.credential);setFeedback('Activation credential copied. Dismiss this panel after you store it securely.');}catch{setFeedback('Copy was unavailable. Select and copy the credential before dismissing this panel.');}};

  if(selectedId){
    const selected=rows.find(row=>row.tenant.id===selectedId)?.tenant;
    return <section className="commercial-console" aria-label="Platform Admin commercial management"><div className="commercial-banner"><div><p className="eyebrow">CADENCE PLATFORM COMMERCIAL CONTROL</p><h2>Laboratory commercial account</h2><p>This workspace manages commercial state only. It does not grant tenant operational-data access.</p></div><button type="button" className="secondary" onClick={()=>{setSecret(null);setSelectedId(null);}}>Back to laboratories</button></div>{feedback&&<p className="commercial-feedback" role="status">{feedback}</p>}{secret&&<section className="one-time-secret" aria-live="polite"><div><p className="eyebrow">ONE-TIME ACTIVATION CREDENTIAL</p><h3>Store this credential securely now</h3><p>It is shown only for {secret.tenantName}. Dismiss, navigation, or reload permanently removes it from this interface.</p><code>{secret.credential}</code></div><div className="actions"><button type="button" className="primary" onClick={()=>void copySecret()}>Copy credential</button><button type="button" className="secondary" onClick={()=>setSecret(null)}>Dismiss and clear</button></div></section>}{detailLoading&&<p className="empty">Loading commercial account from the server…</p>}{detailError&&<p className="error" role="alert">{detailError}</p>}{!detailLoading&&!detailError&&detail&&<CommercialDetail detail={detail} reason={reason} pending={pending} seatDrafts={seatDrafts} onReason={setReason} onIssue={issue} onCredentialAction={credentialAction} onEntitlement={changeEntitlement} onSeatDraft={(key,value)=>setSeatDrafts(current=>({...current,[key]:value}))} onSaveSeat={saveSeat} onLifecycle={lifecycle}/>} {!detailLoading&&!detailError&&!detail&&<p className="empty">{selected?.name??'Laboratory'} is not available.</p>}</section>;
  }

  return <section className="commercial-console" aria-label="Platform Admin commercial management"><div className="commercial-banner"><div><p className="eyebrow">CADENCE PLATFORM COMMERCIAL CONTROL</p><h2>Laboratory commercial accounts</h2><p>You are operating at the CADence platform-commercial level. Tenant operational records are intentionally unavailable here.</p></div><span className="commercial-boundary">Commercial administration only</span></div><div className="commercial-filters"><label>Search laboratories<input className="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name, tenant ID, or commercial reference"/></label><label>Lifecycle status<select value={status} onChange={event=>setStatus(event.target.value as 'all'|TenantStatus)}><option value="all">All lifecycle states</option><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="CANCELLED">Cancelled</option></select></label><button type="button" className="secondary" onClick={()=>void loadDirectory()} disabled={directoryLoading}>{directoryLoading?'Refreshing…':'Refresh from server'}</button></div>{directoryError&&<p className="error" role="alert">{directoryError}</p>}{directoryLoading?<p className="empty">Loading commercial laboratory directory…</p>:!directoryError&&filtered.length===0?<p className="empty">No laboratories match the current commercial filters.</p>:<div className="commercial-table" role="table" aria-label="Commercial laboratory directory"><div className="commercial-table-head" role="row"><span>Laboratory</span><span>Lifecycle</span><span>Activation</span><span>Enabled modules</span><span>NorthStar seats</span><span>Design Studio seats</span><span>Action</span></div>{filtered.map(row=>{const ns=poolFor(row.seatPools,'NORTHSTAR_CORE'),ds=poolFor(row.seatPools,'DESIGN_STUDIO');return <div className="commercial-table-row" role="row" key={row.tenant.id}><strong>{row.tenant.name}<small>{row.tenant.commercialAccountReference??'No commercial reference'} · {row.tenant.id}</small></strong><span className={stateClass(row.tenant.status)}>{row.tenant.status}</span><span className={stateClass(row.tenant.activationState)}>{row.tenant.activationState}</span><span>{row.entitlements.filter(value=>value.state==='ACTIVE').map(value=>value.moduleKey).join(', ')||'None enabled'}</span><span>{ns?`${ns.assignedSeatCount}/${ns.purchasedSeatCount}`:'0/0'}</span><span>{ds?`${ds.assignedSeatCount}/${ds.purchasedSeatCount}`:'0/0'}</span><span><button type="button" className="secondary" onClick={()=>choose(row.tenant.id)}>Manage commercial account</button></span></div>;})}</div>}</section>;
}

function CommercialDetail({detail,reason,pending,seatDrafts,onReason,onIssue,onCredentialAction,onEntitlement,onSeatDraft,onSaveSeat,onLifecycle}:{detail:Detail;reason:string;pending:string|null;seatDrafts:Partial<Record<ModuleKey,string>>;onReason:(value:string)=>void;onIssue:()=>void;onCredentialAction:(credential:Credential,action:'revoke'|'rotate')=>void;onEntitlement:(key:ModuleKey,next:'ACTIVE'|'DISABLED')=>void;onSeatDraft:(key:ModuleKey,value:string)=>void;onSaveSeat:(key:ModuleKey)=>void;onLifecycle:(action:'suspend'|'reactivate'|'cancel')=>void}){
  const {tenant}=detail;
  return <div className="commercial-detail"><section className="commercial-summary"><article><span>Laboratory</span><strong>{tenant.name}</strong><small>{tenant.id}</small></article><article><span>Commercial reference</span><strong>{tenant.commercialAccountReference??'—'}</strong><small>Created {date(tenant.createdAt)}</small></article><article><span>Lifecycle</span><strong className={stateClass(tenant.status)}>{tenant.status}</strong><small>{tenant.status==='SUSPENDED'?`Suspended ${date(tenant.commercialSuspendedAt)}`:tenant.status==='CANCELLED'?`Cancelled ${date(tenant.commercialCancelledAt)}`:`Activated ${date(tenant.commercialActivatedAt)}`}</small></article><article><span>Activation</span><strong className={stateClass(tenant.activationState)}>{tenant.activationState}</strong><small>Server-backed commercial state</small></article></section><section className="commercial-card"><div className="panel-heading"><div><p className="eyebrow">ACTIVATION</p><h3>Activation credentials</h3><p className="note">Full credentials are never stored in the browser and are displayed only when the server issues or rotates them.</p></div><button type="button" className="primary" disabled={tenant.status==='CANCELLED'||pending==='issue'} onClick={onIssue}>{pending==='issue'?'Issuing…':'Issue credential'}</button></div>{detail.credentials.length===0?<p className="empty">No activation credentials have been issued.</p>:<div className="commercial-list">{detail.credentials.map(credential=><div className="commercial-list-row" key={credential.id}><div><strong>{credential.revokedAt?'Revoked credential':credential.activatedAt?'Activated credential':'Pending credential'}</strong><small>Issued {date(credential.issuedAt)} · Expires {date(credential.expiresAt)} · ID {credential.id}</small></div><div className="actions">{!credential.revokedAt&&<button type="button" className="secondary" aria-label={`Rotate activation credential ${credential.id}`} disabled={pending===`rotate-${credential.id}`} onClick={()=>onCredentialAction(credential,'rotate')}>{pending===`rotate-${credential.id}`?'Rotating…':'Rotate'}</button>}{!credential.revokedAt&&<button type="button" className="danger" aria-label={`Revoke activation credential ${credential.id}`} disabled={pending===`revoke-${credential.id}`} onClick={()=>onCredentialAction(credential,'revoke')}>{pending===`revoke-${credential.id}`?'Revoking…':'Revoke'}</button>}</div></div>)}</div>}</section><section className="commercial-card"><p className="eyebrow">MODULES</p><h3>Module entitlements</h3><p className="note">Changes persist through the certified commercial entitlement service. GVM remains entitlement registration only.</p><div className="commercial-list">{modules.map(key=>{const value=entitlementFor(detail.entitlements,key),active=value?.state==='ACTIVE';return <div className="commercial-list-row" key={key}><div><strong>{key}</strong><small>{active?'Enabled server-side':'Disabled or not configured'}{value?.effectiveUntil?` · expires ${date(value.effectiveUntil)}`:''}</small></div><button type="button" className={active?'danger':'secondary'} aria-label={`Set ${key} entitlement to ${active?'DISABLED':'ACTIVE'}`} disabled={pending===`entitlement-${key}`} onClick={()=>onEntitlement(key,active?'DISABLED':'ACTIVE')}>{pending===`entitlement-${key}`?'Saving…':active?'Disable':'Enable'}</button></div>;})}</div></section><section className="commercial-card"><p className="eyebrow">SEATS</p><h3>Purchased seat limits</h3><p className="note">NorthStar and Design Studio pools are independently enforced. Limits cannot be reduced below current assignments.</p><div className="commercial-list">{seatModules.map(key=>{const pool=poolFor(detail.seatPools,key),label=key==='NORTHSTAR_CORE'?'NorthStar':'Design Studio';return <div className="commercial-list-row seat-row" key={key}><div><strong>{label}</strong><small>{pool?`${pool.assignedSeatCount} assigned · ${pool.availableSeatCount} available`:'No seat pool configured yet'}</small></div><label>Purchased seats<input aria-label={`${label} purchased seats`} type="number" min={pool?.assignedSeatCount??0} value={seatDrafts[key]??''} onChange={event=>onSeatDraft(key,event.target.value)}/></label><button type="button" className="secondary" aria-label={`Save ${label} seat limit`} disabled={pending===`seat-${key}`} onClick={()=>onSaveSeat(key)}>{pending===`seat-${key}`?'Saving…':'Save limit'}</button></div>;})}</div></section><section className="commercial-card commercial-lifecycle"><p className="eyebrow">LIFECYCLE</p><h3>Commercial lifecycle controls</h3><p className="note">Suspension and cancellation preserve historical data. Reactivation never creates additional memberships, entitlements, or seats.</p><label>Reason for credential or lifecycle action<textarea value={reason} onChange={event=>onReason(event.target.value)} placeholder="Required for suspend, reactivate, and cancel"/></label><div className="actions"><button type="button" className="secondary" disabled={tenant.status==='SUSPENDED'||tenant.status==='CANCELLED'||pending==='lifecycle-suspend'} onClick={()=>onLifecycle('suspend')}>{pending==='lifecycle-suspend'?'Suspending…':'Suspend laboratory'}</button><button type="button" className="secondary" disabled={tenant.status!=='SUSPENDED'||pending==='lifecycle-reactivate'} onClick={()=>onLifecycle('reactivate')}>{pending==='lifecycle-reactivate'?'Reactivating…':'Reactivate laboratory'}</button><button type="button" className="danger" disabled={tenant.status==='CANCELLED'||pending==='lifecycle-cancel'} onClick={()=>onLifecycle('cancel')}>{pending==='lifecycle-cancel'?'Cancelling…':'Cancel laboratory'}</button></div></section><section className="commercial-card"><p className="eyebrow">COMMERCIAL AUDIT HISTORY</p><h3>Immutable commercial audit events</h3>{detail.audit.length===0?<p className="empty">No commercial audit events are available.</p>:<div className="commercial-list commercial-audit">{detail.audit.map((event,index)=><div className="commercial-list-row" key={`${event.occurredAt}-${event.entityId}-${index}`}><div><strong>{event.action}</strong><small>{date(event.occurredAt)} · {event.actorName} · {reasonFrom(event.metadata)||'No reason recorded'}</small></div><span className="commercial-audit-state">{resultingState(event.metadata)} · {event.entityId}</span></div>)}</div>}</section></div>;
}
