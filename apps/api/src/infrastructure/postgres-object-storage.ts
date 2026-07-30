import { createHash, randomUUID } from 'node:crypto';
import type { ObjectStorage, PutObjectInput, StoredObject } from './object-storage.js';
import type { SqlExecutor } from './postgres.js';

type ObjectRow={bytes:Buffer};

export class PostgresObjectStorage implements ObjectStorage {
  constructor(private readonly db:SqlExecutor,private readonly bucket='northstar-postgres'){}
  async put(input:PutObjectInput):Promise<StoredObject>{
    const id=randomUUID();
    const objectKey=`${input.tenantId}/${input.ownerType}/${input.ownerId}/${id}-${input.fileName}`;
    const checksumSha256=createHash('sha256').update(input.bytes).digest('hex');
    await this.db.query('INSERT INTO object_payloads(object_key,bytes) VALUES($1,$2)',[objectKey,Buffer.from(input.bytes)]);
    await this.db.query('INSERT INTO object_records(id,tenant_id,owner_type,owner_id,kind,provider,bucket,object_key,file_name,mime_type,size_bytes,checksum_sha256,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)',[id,input.tenantId,input.ownerType,input.ownerId,input.kind,'postgres',this.bucket,objectKey,input.fileName,input.mimeType,input.bytes.byteLength,checksumSha256,JSON.stringify(input.metadata??{})]);
    return{id,tenantId:input.tenantId,ownerType:input.ownerType,ownerId:input.ownerId,kind:input.kind,provider:'postgres',bucket:this.bucket,objectKey,fileName:input.fileName,mimeType:input.mimeType,size:input.bytes.byteLength,checksumSha256,metadata:input.metadata??{},createdAt:new Date().toISOString()};
  }
  async get(objectKey:string){const result=await this.db.query<ObjectRow>('SELECT bytes FROM object_payloads WHERE object_key=$1',[objectKey]);return result.rows[0]?new Uint8Array(result.rows[0].bytes):null}
  async delete(objectKey:string){await this.db.query('UPDATE object_records SET deleted_at=now() WHERE object_key=$1',[objectKey]);await this.db.query('DELETE FROM object_payloads WHERE object_key=$1',[objectKey])}
}
