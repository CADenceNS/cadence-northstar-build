import { createHash, randomUUID } from 'node:crypto';

export type StoredObjectKind='stl'|'obj'|'ply'|'dicom'|'cbct'|'xray'|'clinical-photo'|'shade-photo'|'qc-photo'|'rx-pdf'|'intake-document'|'intake-package'|'prescription-pdf'|'shipping-document'|'invoice-pdf';
export interface PutObjectInput { tenantId:string; ownerType:string; ownerId:string; kind:StoredObjectKind; fileName:string; mimeType:string; bytes:Uint8Array; metadata?:Record<string,string>; }
export interface StoredObject { id:string; tenantId:string; ownerType:string; ownerId:string; kind:StoredObjectKind; provider:string; bucket:string; objectKey:string; fileName:string; mimeType:string; size:number; checksumSha256:string; metadata:Record<string,string>; createdAt:string; }
export interface ObjectStorage { put(input:PutObjectInput):Promise<StoredObject>; get(objectKey:string):Promise<Uint8Array|null>; delete(objectKey:string):Promise<void>; }

export class InMemoryObjectStorage implements ObjectStorage {
  private readonly objects=new Map<string,{record:StoredObject;bytes:Uint8Array}>();
  constructor(private readonly bucket='northstar-test'){}
  async put(input:PutObjectInput){const id=randomUUID(),objectKey=`${input.tenantId}/${input.ownerType}/${input.ownerId}/${id}-${input.fileName}`;const record:StoredObject={id,tenantId:input.tenantId,ownerType:input.ownerType,ownerId:input.ownerId,kind:input.kind,provider:'memory',bucket:this.bucket,objectKey,fileName:input.fileName,mimeType:input.mimeType,size:input.bytes.byteLength,checksumSha256:createHash('sha256').update(input.bytes).digest('hex'),metadata:input.metadata??{},createdAt:new Date().toISOString()};this.objects.set(objectKey,{record,bytes:new Uint8Array(input.bytes)});return record}
  async get(objectKey:string){const value=this.objects.get(objectKey);return value?new Uint8Array(value.bytes):null}
  async delete(objectKey:string){this.objects.delete(objectKey)}
}

export interface ExternalObjectProvider {
  providerName:string;
  bucket:string;
  upload(objectKey:string,bytes:Uint8Array,mimeType:string,metadata:Record<string,string>):Promise<void>;
  download(objectKey:string):Promise<Uint8Array|null>;
  remove(objectKey:string):Promise<void>;
}
export class ProviderBackedObjectStorage implements ObjectStorage {
  constructor(private readonly provider:ExternalObjectProvider){}
  async put(input:PutObjectInput){const id=randomUUID(),objectKey=`${input.tenantId}/${input.ownerType}/${input.ownerId}/${id}-${input.fileName}`,checksumSha256=createHash('sha256').update(input.bytes).digest('hex');await this.provider.upload(objectKey,input.bytes,input.mimeType,{...(input.metadata??{}),checksumSha256});return{id,tenantId:input.tenantId,ownerType:input.ownerType,ownerId:input.ownerId,kind:input.kind,provider:this.provider.providerName,bucket:this.provider.bucket,objectKey,fileName:input.fileName,mimeType:input.mimeType,size:input.bytes.byteLength,checksumSha256,metadata:input.metadata??{},createdAt:new Date().toISOString()}}
  get(objectKey:string){return this.provider.download(objectKey)}
  delete(objectKey:string){return this.provider.remove(objectKey)}
}
