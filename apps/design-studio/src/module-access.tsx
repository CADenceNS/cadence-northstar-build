import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

type AccessState='checking'|'allowed'|'denied';

/** The Design Studio client never decides tenant/module authority locally.
 * The gateway derives the tenant from the authenticated server session and
 * confirms both entitlement and the module-specific seat assignment. */
export function DesignStudioAccessGate({children}:{children:ReactNode}){
  const[state,setState]=useState<AccessState>('checking');
  useEffect(()=>{let current=true;fetch('/api/modules/DESIGN_STUDIO/access').then(response=>{if(!current)return;setState(response.ok?'allowed':'denied');}).catch(()=>{if(current)setState('denied');});return()=>{current=false;};},[]);
  if(state==='checking')return <main aria-busy="true"><h1>Securing Design Studio</h1><p>Verifying your organization entitlement and assigned seat.</p></main>;
  if(state==='denied')return <main role="alert"><h1>Design Studio access denied</h1><p>Your authenticated laboratory account does not have an active Design Studio entitlement and assigned seat.</p></main>;
  return <>{children}</>;
}
