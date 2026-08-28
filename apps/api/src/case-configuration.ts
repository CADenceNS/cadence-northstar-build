import type { Pool, PoolClient } from 'pg';

type Db=Pool|PoolClient;
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown)=>typeof value==='string'?value.trim():'';

export type OptionValue={id:string;code:string;label:string;metadata:Record<string,unknown>;active:boolean;displayOrder:number};
export type ConfigurationRequirement={id:string;fieldKey:string;label:string;requirementState:'REQUIRED'|'OPTIONAL'|'HIDDEN';allowCustom:boolean;displayOrder:number;optionSet:null|{id:string;code:string;label:string;values:OptionValue[]}};
export type RestorationSubtype={id:string;categoryCode:string;code:string;label:string;active:boolean;displayOrder:number};

export async function subtypesForCategory(db:Db,tenantId:string,categoryCode:string,includeInactive=false){
  const result=await db.query<{id:string;category_code:string;code:string;label:string;active:boolean;display_order:number}>(`SELECT DISTINCT subtype.id,subtype.category_code,subtype.code,subtype.label,subtype.active,subtype.display_order
    FROM tenant_restoration_subtypes subtype
    JOIN product_restoration_subtype_mappings mapping ON mapping.tenant_id=subtype.tenant_id AND mapping.subtype_id=subtype.id AND mapping.active
    JOIN product_catalog product ON product.tenant_id=mapping.tenant_id AND product.id=mapping.product_id AND product.active AND product.archived_at IS NULL
    WHERE subtype.tenant_id=$1 AND subtype.category_code=$2 ${includeInactive?'':'AND subtype.active'}
    ORDER BY subtype.display_order,subtype.label`,[tenantId,categoryCode]);
  return result.rows.map(row=>({id:row.id,categoryCode:row.category_code,code:row.code,label:row.label,active:row.active,displayOrder:row.display_order}));
}

export async function configurationForProduct(db:Db,tenantId:string,productId:string){
  const requirementRows=await db.query<{id:string;field_key:string;label:string;requirement_state:'REQUIRED'|'OPTIONAL'|'HIDDEN';allow_custom:boolean;display_order:number;option_set_id:string|null;option_set_code:string|null;option_set_label:string|null}>(`SELECT requirement.id,requirement.field_key,requirement.label,requirement.requirement_state,requirement.allow_custom,requirement.display_order,
    option_set.id option_set_id,option_set.code option_set_code,option_set.label option_set_label
    FROM product_configuration_requirements requirement
    LEFT JOIN tenant_option_sets option_set ON option_set.tenant_id=requirement.tenant_id AND option_set.id=requirement.option_set_id AND option_set.active
    WHERE requirement.tenant_id=$1 AND requirement.product_id=$2
    ORDER BY requirement.display_order,requirement.field_key`,[tenantId,productId]);
  const setIds=requirementRows.rows.flatMap(row=>row.option_set_id?[row.option_set_id]:[]);
  const values=setIds.length?await db.query<{id:string;option_set_id:string;code:string;label:string;metadata:Record<string,unknown>;active:boolean;display_order:number}>(`SELECT id,option_set_id,code,label,metadata,active,display_order FROM tenant_option_values WHERE tenant_id=$1 AND option_set_id=ANY($2::uuid[]) AND active=true ORDER BY display_order,code`,[tenantId,setIds]):{rows:[]};
  return requirementRows.rows.map(row=>({id:row.id,fieldKey:row.field_key,label:row.label,requirementState:row.requirement_state,allowCustom:row.allow_custom,displayOrder:row.display_order,optionSet:row.option_set_id?{id:row.option_set_id,code:row.option_set_code!,label:row.option_set_label!,values:values.rows.filter(value=>value.option_set_id===row.option_set_id).map(value=>({id:value.id,code:value.code,label:value.label,metadata:object(value.metadata),active:value.active,displayOrder:value.display_order}))}:null} satisfies ConfigurationRequirement));
}

export async function subtypeForProduct(db:Db,tenantId:string,productId:string,subtypeId:string){
  const result=await db.query<{id:string;category_code:string;code:string;label:string}>(`SELECT subtype.id,subtype.category_code,subtype.code,subtype.label
    FROM product_restoration_subtype_mappings mapping
    JOIN tenant_restoration_subtypes subtype ON subtype.tenant_id=mapping.tenant_id AND subtype.id=mapping.subtype_id
    WHERE mapping.tenant_id=$1 AND mapping.product_id=$2 AND mapping.subtype_id=$3 AND mapping.active AND subtype.active`,[tenantId,productId,subtypeId]);
  return result.rows[0]??null;
}

function optionCode(value:unknown){return typeof value==='string'?value.trim():text(object(value).code);}
function customText(value:unknown){return text(object(value).customText);}
function isCustom(code:string){return ['CUSTOM','CUSTOM_SHADE','OTHER_CUSTOM'].includes(code);}

export async function normalizeConfiguration(db:Db,tenantId:string,productId:string,input:unknown){
  const requirements=await configurationForProduct(db,tenantId,productId),source=object(input),normalized:Record<string,unknown>={};
  for(const requirement of requirements){
    if(requirement.requirementState==='HIDDEN')continue;
    const raw=source[requirement.fieldKey],code=optionCode(raw);
    if(!code){if(requirement.requirementState==='REQUIRED')throw new Error(`${requirement.label} is required.`);continue;}
    if(!requirement.optionSet){normalized[requirement.fieldKey]=raw;continue;}
    const option=requirement.optionSet.values.find(value=>value.code===code);
    if(!option)throw new Error(`Select an active ${requirement.label} option.`);
    const custom=isCustom(option.code)?customText(raw):'';
    if(isCustom(option.code)&&!requirement.allowCustom)throw new Error(`${requirement.label} does not permit a custom value.`);
    if(isCustom(option.code)&&!custom)throw new Error(`Enter a custom value for ${requirement.label}.`);
    normalized[requirement.fieldKey]={optionSetCode:requirement.optionSet.code,code:option.code,label:option.label,...(custom?{customText:custom}:{})};
  }
  const shade=object(normalized.shade),shadeSystem=object(normalized.shadeSystem),selectedShadeSystem=text(shadeSystem.code),shadeCode=text(shade.code);
  if(shadeCode&&selectedShadeSystem){
    const shadeRequirement=requirements.find(requirement=>requirement.fieldKey==='shade');
    const shadeOption=shadeRequirement?.optionSet?.values.find(value=>value.code===shadeCode);
    const applicableSystem=text(shadeOption?.metadata?.shadeSystem);
    if(applicableSystem&&applicableSystem!==selectedShadeSystem)throw new Error('Select a shade that belongs to the selected shade system.');
  }
  return normalized;
}
