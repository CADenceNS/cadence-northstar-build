import assert from 'node:assert/strict';
import { InMemoryAuditRepository } from './audit.js';
import { InMemoryObjectStorage } from './object-storage.js';

const audit=new InMemoryAuditRepository();
await audit.append({tenantId:'tenant-1',actorId:'user-1',actorName:'Dorian Habet',action:'case-created',entityType:'case',entityId:'case-1',occurredAt:'2026-07-27T00:00:00.000Z',metadata:{caseNumber:'NS-260727-001'}});
const events=await audit.list('tenant-1','case','case-1');
assert.equal(events.length,1);assert.equal(events[0]?.action,'case-created');
assert.throws(()=>{(events[0]!.metadata as Record<string,unknown>).caseNumber='changed'});

const storage=new InMemoryObjectStorage();
const bytes=new TextEncoder().encode('durable-persistence-contract');
const record=await storage.put({tenantId:'tenant-1',ownerType:'case',ownerId:'case-1',kind:'stl',fileName:'upper.stl',mimeType:'model/stl',bytes});
assert.equal(record.provider,'memory');assert.equal(record.size,bytes.byteLength);assert.equal(record.checksumSha256.length,64);
assert.deepEqual(await storage.get(record.objectKey),bytes);
await storage.delete(record.objectKey);assert.equal(await storage.get(record.objectKey),null);
console.log('Repository infrastructure contracts passed.');
