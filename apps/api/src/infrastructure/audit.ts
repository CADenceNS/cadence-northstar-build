import type { AuditEventInput, AuditRepository } from './contracts.js';

export class InMemoryAuditRepository implements AuditRepository {
  private readonly events:Readonly<AuditEventInput>[]=[];
  async append(event:AuditEventInput){this.events.push(Object.freeze({...event,metadata:Object.freeze({...event.metadata})}))}
  async list(tenantId:string,entityType?:string,entityId?:string){return this.events.filter(event=>event.tenantId===tenantId&&(!entityType||event.entityType===entityType)&&(!entityId||event.entityId===entityId)).slice().reverse()}
}

export async function auditedMutation<T>(audit:AuditRepository,event:AuditEventInput,mutation:()=>Promise<T>){const result=await mutation();await audit.append(event);return result}
