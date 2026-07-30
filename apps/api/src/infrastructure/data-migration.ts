import type { ClinicalCase, Doctor, Invoice, MonthlyStatement, Patient, Practice, ProductionWorkItem, QCInspection, QCTemplate, Shipment, User } from '@northstar/shared';
import type { RepositoryContext, RepositoryRegistry } from './contracts.js';

export interface LegacySnapshot { version:1; exportedAt:string; users:User[]; practices:Practice[]; doctors:Doctor[]; patients:Patient[]; cases:ClinicalCase[]; production:ProductionWorkItem[]; qcTemplates:QCTemplate[]; qcInspections:QCInspection[]; shipments:Shipment[]; invoices:Invoice[]; statements:MonthlyStatement[]; }
export interface MigrationReport { inserted:Record<string,number>; warnings:string[]; }

export async function importLegacySnapshot(snapshot:LegacySnapshot,repositories:RepositoryRegistry,context:RepositoryContext):Promise<MigrationReport>{
  if(snapshot.version!==1)throw new Error(`Unsupported snapshot version: ${String(snapshot.version)}`);
  const inserted:Record<string,number>={},warnings:string[]=[];
  const saveAll=async<T>(name:string,values:T[],save:(value:T)=>Promise<void>)=>{for(const value of values)await save(value);inserted[name]=values.length};
  await repositories.transaction(async tx=>{
    await saveAll('users',snapshot.users,value=>tx.users.save(context,value));
    await saveAll('practices',snapshot.practices,value=>tx.practices.save(context,value));
    await saveAll('doctors',snapshot.doctors,value=>tx.doctors.save(context,value));
    await saveAll('patients',snapshot.patients,value=>tx.patients.save(context,value));
    await saveAll('cases',snapshot.cases,value=>tx.cases.save(context,value));
    await saveAll('production',snapshot.production,value=>tx.production.save(context,value));
    await saveAll('qcTemplates',snapshot.qcTemplates,value=>tx.qc.saveTemplate(context,value));
    await saveAll('qcInspections',snapshot.qcInspections,value=>tx.qc.saveInspection(context,value));
    await saveAll('shipments',snapshot.shipments,value=>tx.shipping.save(context,value));
    await saveAll('invoices',snapshot.invoices,value=>tx.financial.saveInvoice(context,value));
    await saveAll('statements',snapshot.statements,value=>tx.financial.saveStatement(context,value));
    await tx.audit.append({tenantId:context.tenantId,actorId:context.actorId,actorName:context.actorName,action:'legacy-snapshot-imported',entityType:'migration',entityId:snapshot.exportedAt,occurredAt:new Date().toISOString(),metadata:{inserted,snapshotVersion:snapshot.version}});
  });
  if(snapshot.users.some(user=>!user.active))warnings.push('Inactive users were preserved and require authorization review.');
  if(snapshot.invoices.some(invoice=>invoice.balance<0))warnings.push('Negative invoice balances require manual reconciliation.');
  return{inserted,warnings};
}
