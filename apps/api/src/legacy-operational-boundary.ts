/**
 * CF-1A0 keeps the pre-CF-1 operational runtime fail-closed: only its migrated
 * legacy tenant may reach operational repositories.  Other authenticated
 * laboratories receive no default-tenant fallback while tenant-native records
 * are still a CF-1A responsibility.
 */
export function mayAccessLegacyOperationalRuntime(trustedTenantId:string,legacyTenantId:string){
  return Boolean(trustedTenantId)&&trustedTenantId===legacyTenantId;
}
