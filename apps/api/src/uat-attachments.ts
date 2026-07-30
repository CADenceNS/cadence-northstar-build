import { randomUUID } from 'node:crypto';
import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import type { AuditRepository } from './infrastructure/contracts.js';
import type { ObjectStorage } from './infrastructure/object-storage.js';
import type { SecurityRequest } from './security.js';

const allowedMime=new Set(['image/png','image/jpeg','image/webp']);
const maxBytes=5*1024*1024;
const ownerTables={
 'test-case':{table:'uat_test_cases'},
 execution:{table:'uat_executions'},
 defect:{table:'uat_defects'}
} as const;
type OwnerType=keyof typeof ownerTables;
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const safeName=(value:string)=>value.replace(/[^a-zA-Z0-9._-]/g,'_').replace(/^\.+/,'').slice(0,120)||'uat-evidence.png';
function identity(req:SecurityRequest,res:Response){if(!req.identity){res.status(401).json({error:'Authentication required.'});return null}return req.identity}
async function owns(pool:Pool,tenantId:string,ownerType:OwnerType,ownerId:string){const table=ownerTables[ownerType].table;const result=await pool.query(`SELECT 1 FROM ${table} WHERE tenant_id=$1 AND id=$2`,[tenantId,ownerId]);return Boolean(result.rowCount)}

export function installUatAttachments(app:Express,deps:{pool:Pool;objects:ObjectStorage;audit:AuditRepository}){
 const{pool,objects,audit}=deps;
 app.get('/api/uat/evidence/:ownerType/:ownerId/attachments',async(req:SecurityRequest,res)=>{const actor=identity(req,res);if(!actor)return;const ownerType=req.params.ownerType as OwnerType;if(!(ownerType in ownerTables)||!await owns(pool,actor.tenantId,ownerType,req.params.ownerId))return res.status(404).json({error:'UAT evidence owner not found.'});const result=await pool.query(`SELECT a.id,a.owner_type AS "ownerType",a.owner_id AS "ownerId",o.id AS "objectId",o.file_name AS "fileName",o.mime_type AS "mimeType",o.size_bytes::int AS size,o.kind,o.created_at AS "createdAt" FROM uat_evidence_attachments a JOIN object_records o ON o.id=a.object_id AND o.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.owner_type=$2 AND a.owner_id=$3 ORDER BY a.created_at DESC`,[actor.tenantId,ownerType,req.params.ownerId]);return res.json(result.rows)});
 app.post('/api/uat/evidence/:ownerType/:ownerId/attachments',async(req:SecurityRequest,res)=>{const actor=identity(req,res);if(!actor)return;const ownerType=req.params.ownerType as OwnerType;if(!(ownerType in ownerTables)||!await owns(pool,actor.tenantId,ownerType,req.params.ownerId))return res.status(404).json({error:'UAT evidence owner not found.'});const mimeType=text(req.body?.mimeType).toLowerCase(),fileName=safeName(text(req.body?.fileName)),encoded=text(req.body?.contentBase64);if(!allowedMime.has(mimeType))return res.status(415).json({error:'Only PNG, JPEG, and WebP screenshots are accepted.'});let bytes:Buffer;try{bytes=Buffer.from(encoded,'base64')}catch{return res.status(400).json({error:'Screenshot content is invalid.'})}if(!bytes.length||bytes.length>maxBytes)return res.status(413).json({error:'Screenshot must be between 1 byte and 5 MB.'});const stored=await objects.put({tenantId:actor.tenantId,ownerType:`uat-${ownerType}`,ownerId:req.params.ownerId,kind:'uat-screenshot',fileName,mimeType,bytes,metadata:{uploadedBy:actor.userId}});const attachmentId=randomUUID();await pool.query(`INSERT INTO uat_evidence_attachments(id,tenant_id,owner_type,owner_id,object_id,uploaded_by) VALUES($1,$2,$3,$4,$5,$6)`,[attachmentId,actor.tenantId,ownerType,req.params.ownerId,stored.id,actor.userId]);await audit.append({tenantId:actor.tenantId,actorId:actor.userId,actorName:actor.name,action:'uat.evidence.attached',entityType:`uat-${ownerType}`,entityId:req.params.ownerId,occurredAt:new Date().toISOString(),metadata:{attachmentId,objectId:stored.id,mimeType,size:stored.size}});return res.status(201).json({id:attachmentId,ownerType,ownerId:req.params.ownerId,objectId:stored.id,fileName:stored.fileName,mimeType:stored.mimeType,size:stored.size,kind:stored.kind,createdAt:stored.createdAt})});
 app.get('/api/uat/attachments/:id/content',async(req:SecurityRequest,res)=>{const actor=identity(req,res);if(!actor)return;const result=await pool.query(`SELECT o.object_key,o.file_name,o.mime_type,o.size_bytes FROM uat_evidence_attachments a JOIN object_records o ON o.id=a.object_id AND o.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.id=$2`,[actor.tenantId,req.params.id]);if(!result.rowCount)return res.status(404).json({error:'Attachment not found.'});const row=result.rows[0],bytes=await objects.get(row.object_key);if(!bytes)return res.status(404).json({error:'Attachment content not found.'});res.setHeader('Content-Type',row.mime_type);res.setHeader('Content-Disposition',`inline; filename="${safeName(row.file_name)}"`);res.setHeader('Content-Length',String(bytes.byteLength));res.setHeader('Cache-Control','private, no-store');return res.send(Buffer.from(bytes))});
}
