import { randomUUID } from 'node:crypto';
import type { CaseProductLineInput, CaseProductLineSnapshot, ClinicalCaseInput, ProductCategoryCode, ProductPricingBasis } from '@northstar/shared';
import type { Pool, PoolClient } from 'pg';

const categories=new Set<ProductCategoryCode>(['FIX','REM','IMP','ORT','SLP','DIA','SPL','AUX']);
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const list=(value:unknown)=>Array.isArray(value)?value:[];
const numeric=(value:unknown)=>typeof value==='number'?value:Number(value);
export function calendarDate(value:unknown,label='calendar date'){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error(`${label} must be a canonical YYYY-MM-DD calendar date.`);
  const parsed=new Date(`${value}T12:00:00Z`);
  if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw new Error(`${label} must be a valid YYYY-MM-DD calendar date.`);
  return value;
}

type ProductRow={id:string;sku:string;product_name:string;description:string;category_code:ProductCategoryCode;family_code:string;pricing_basis:ProductPricingBasis;default_turnaround_business_days:number|null;configuration_metadata:Record<string,unknown>;active:boolean;archived_at:string|null};
type PriceRow={id:string;pricing_basis:ProductPricingBasis;amount:string};
export type PreparedCaseProductLines={lines:CaseProductLineSnapshot[];subtotal:number;calculatedDueDate:string;turnaroundBusinessDays:number;};

function validateConfiguration(product:ProductRow,line:CaseProductLineInput){
  const config=object(product.configuration_metadata),arch=text(line.arch).toLowerCase(),teeth=list(line.toothNumbers).map(Number).filter(Number.isInteger),selection=text(config.selection),allowed=list(config.allowedArches).map(item=>text(item).toLowerCase());
  if(allowed.length&&(!arch||!allowed.includes(arch)))return 'This product requires an allowed arch configuration.';
  if(['SINGLE_TOOTH','MULTIPLE_TEETH','PARTIAL_ARCH'].includes(selection)&&!teeth.length)return 'This product requires Universal tooth selection.';
  if(selection==='SINGLE_TOOTH'&&teeth.length!==1)return 'This product requires exactly one Universal tooth.';
  const minTeeth=numeric(config.minTeeth),maxTeeth=numeric(config.maxTeeth),minUnits=numeric(config.minUnits),maxStages=numeric(config.maxStages),unitCount=numeric(line.unitCount),stageCount=numeric(line.stageCount),componentCount=numeric(line.componentCount);
  if(Number.isFinite(minTeeth)&&teeth.length<minTeeth)return `This product requires at least ${minTeeth} tooth selection(s).`;
  if(Number.isFinite(maxTeeth)&&teeth.length>maxTeeth)return `This product permits at most ${maxTeeth} tooth selection(s).`;
  if(Number.isFinite(minUnits)&&(!Number.isFinite(unitCount)||unitCount<minUnits))return `This product requires at least ${minUnits} unit(s).`;
  if(selection==='STAGE_COUNT'&&(!Number.isFinite(stageCount)||stageCount<=0))return 'This product requires a positive stage count.';
  if(Number.isFinite(maxStages)&&Number.isFinite(stageCount)&&stageCount>maxStages)return `This product permits at most ${maxStages} stages.`;
  if(line.componentCount!==undefined&&line.componentCount!==null&&(!Number.isFinite(componentCount)||componentCount<=0))return 'Component count must be positive.';
  return null;
}
function fallbackTat(category:ProductCategoryCode){return category==='FIX'?10:['REM','IMP','SLP'].includes(category)?14:null;}
function addBusinessDays(receivedDate:string,days:number,closures:Set<string>){const result=new Date(`${calendarDate(receivedDate,'received date')}T12:00:00Z`);let remaining=days;while(remaining>0){result.setUTCDate(result.getUTCDate()+1);const key=result.toISOString().slice(0,10);if(result.getUTCDay()!==0&&result.getUTCDay()!==6&&!closures.has(key))remaining--;}return result.toISOString().slice(0,10);}
// Case Journey records may retain a repository-backed practice key while a price
// override is stored against PostgreSQL's UUID practice identifier. Comparing the
// nullable override as text preserves an exact UUID match when one exists and lets
// a legacy key use the tenant-wide price without asking PostgreSQL to coerce it.
async function currentPrice(db:Pool|PoolClient,tenantId:string,productId:string,practiceId:string,receivedDate:string){const result=await db.query<PriceRow>('SELECT id,pricing_basis,amount FROM product_price_versions WHERE tenant_id=$1 AND product_id=$2 AND active=true AND effective_from <= $3::date AND (effective_until IS NULL OR effective_until > $3::date) AND (practice_id IS NULL OR practice_id::text=$4) ORDER BY (practice_id IS NOT NULL) DESC,effective_from DESC LIMIT 1',[tenantId,productId,receivedDate,practiceId]);return result.rows[0]??null;}

export async function loadTenantClosureDates(db:Pool|PoolClient,tenantId:string){
  // PostgreSQL DATE is a calendar day. Project it as text before it enters the
  // business-day domain so node-postgres cannot apply Date-object semantics.
  const closures=await db.query<{closure_date:string}>('SELECT closure_date::text AS closure_date FROM tenant_business_closure_days WHERE tenant_id=$1 ORDER BY closure_date',[tenantId]);
  return closures.rows.map(item=>calendarDate(item.closure_date,'tenant closure date'));
}

export async function quoteCaseBuilderProduct(db:Pool|PoolClient,tenantId:string,productId:string,practiceId:string,receivedDate:string){
  const canonicalReceivedDate=calendarDate(receivedDate,'received date');
  const productResult=await db.query<ProductRow>('SELECT id,sku,product_name,description,category_code,family_code,pricing_basis,default_turnaround_business_days,configuration_metadata,active,archived_at FROM product_catalog WHERE tenant_id=$1 AND id=$2 AND active=true AND archived_at IS NULL',[tenantId,productId]);
  const product=productResult.rows[0];if(!product)throw new Error('Active product not found in this tenant.');
  const price=await currentPrice(db,tenantId,productId,practiceId,canonicalReceivedDate);
  const tat=product.default_turnaround_business_days??fallbackTat(product.category_code);
  return {product:{id:product.id,sku:product.sku,productName:product.product_name,description:product.description,categoryCode:product.category_code,familyCode:product.family_code,pricingBasis:product.pricing_basis,configuration:product.configuration_metadata,defaultTurnaroundBusinessDays:tat},price:price?{id:price.id,amount:Number(price.amount),pricingBasis:price.pricing_basis}:null,priceConfigured:Boolean(price),turnaroundBusinessDays:tat};
}

export async function prepareCaseProductLines(db:Pool|PoolClient,tenantId:string,body:Pick<ClinicalCaseInput,'practiceId'|'receivedDate'|'productLines'>){
  const supplied=body.productLines??[];
  if(!supplied.length)throw new Error('At least one authoritative Case Product Line is required.');
  const lines:CaseProductLineSnapshot[]=[];
  for(const [index,raw] of supplied.entries()){
    const line=raw as CaseProductLineInput,productId=text(line.productId),category=text(line.categoryCode).toUpperCase() as ProductCategoryCode,quantity=numeric(line.quantity);
    if(!productId||!categories.has(category)||!Number.isFinite(quantity)||quantity<=0)throw new Error('Each Case Product Line requires a tenant product, category, and positive quantity.');
    const quote=await quoteCaseBuilderProduct(db,tenantId,productId,body.practiceId,body.receivedDate);
    if(quote.product.categoryCode!==category)throw new Error('Product is not permitted for the selected restoration category.');
    const configError=validateConfiguration({id:quote.product.id,sku:quote.product.sku,product_name:quote.product.productName,description:quote.product.description,category_code:quote.product.categoryCode,family_code:quote.product.familyCode,pricing_basis:quote.product.pricingBasis,default_turnaround_business_days:quote.product.defaultTurnaroundBusinessDays,configuration_metadata:quote.product.configuration,active:true,archived_at:null},line);if(configError)throw new Error(configError);
    if(!quote.price)throw new Error(`PRICE NOT CONFIGURED for ${quote.product.productName}.`);
    if(!quote.turnaroundBusinessDays)throw new Error(`Turnaround is not configured for ${quote.product.productName}.`);
    lines.push({id:randomUUID(),lineNumber:index+1,productId,categoryCode:category,productSku:quote.product.sku,productName:quote.product.productName,productDescription:quote.product.description,familyCode:quote.product.familyCode,pricingBasis:quote.price.pricingBasis,unitPrice:quote.price.amount,lineTotal:Math.round(quote.price.amount*quantity*100)/100,priceVersionId:quote.price.id,quantity,arch:text(line.arch)||null,toothNumbers:list(line.toothNumbers).map(Number).filter(Number.isInteger),unitCount:line.unitCount??null,stageCount:line.stageCount??null,componentCount:line.componentCount??null,configuration:object(line.configuration),options:object(line.options),notes:text(line.notes),turnaroundBusinessDays:quote.turnaroundBusinessDays});
  }
  for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
    const result=await db.query('SELECT 1 FROM product_compatibility_rules WHERE tenant_id=$1 AND active=true AND rule_type IN (\'BLOCKED\',\'MUTUALLY_EXCLUSIVE\') AND ((source_product_id=$2 AND target_product_id=$3) OR (source_product_id=$3 AND target_product_id=$2)) LIMIT 1',[tenantId,lines[i]!.productId,lines[j]!.productId]);
    if(result.rowCount)throw new Error('Selected Case Product Lines contain an incompatible product stack.');
  }
  const closureDates=await loadTenantClosureDates(db,tenantId);
  const turnaroundBusinessDays=Math.max(...lines.map(line=>line.turnaroundBusinessDays??0));
  return {lines,subtotal:lines.reduce((total,line)=>total+line.lineTotal,0),turnaroundBusinessDays,calculatedDueDate:addBusinessDays(calendarDate(body.receivedDate,'received date'),turnaroundBusinessDays,new Set(closureDates))} satisfies PreparedCaseProductLines;
}

export async function savePreparedCaseProductLines(client:PoolClient,tenantId:string,caseId:string,lines:CaseProductLineSnapshot[],actorId:string){
  await client.query(`INSERT INTO case_product_line_case_entities(tenant_id,case_entity_type,case_id) VALUES($1,'case',$2) ON CONFLICT DO NOTHING`,[tenantId,caseId]);
  for(const line of lines)await client.query(`INSERT INTO case_product_lines(id,tenant_id,case_entity_type,case_id,product_id,price_version_id,line_number,category_code,family_code_snapshot,product_sku_snapshot,product_name_snapshot,description_snapshot,pricing_basis_snapshot,unit_price_snapshot,quantity,line_total,arch,tooth_numbers,unit_count,stage_count,component_count,configuration,options,turnaround_business_days,notes,created_by) VALUES($1,$2,'case',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb,$23,$24,$25)`,[line.id,tenantId,caseId,line.productId,line.priceVersionId,line.lineNumber,line.categoryCode,line.familyCode,line.productSku,line.productName,line.productDescription,line.pricingBasis,line.unitPrice,line.quantity,line.lineTotal,line.arch,line.toothNumbers,line.unitCount,line.stageCount,line.componentCount,JSON.stringify(line.configuration??{}),JSON.stringify(line.options??{}),line.turnaroundBusinessDays,line.notes??'',actorId]);
}
