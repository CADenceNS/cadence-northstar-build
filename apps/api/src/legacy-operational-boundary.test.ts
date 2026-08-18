import assert from 'node:assert/strict';
import { mayAccessLegacyOperationalRuntime } from './legacy-operational-boundary.js';

const keramos='00000000-0000-0000-0000-000000000001';
const labA='00000000-0000-0000-0000-000000000002';
assert.equal(mayAccessLegacyOperationalRuntime(keramos,keramos),true,'the migrated legacy tenant retains its existing operational access');
assert.equal(mayAccessLegacyOperationalRuntime(labA,keramos),false,'an authenticated Lab A must never fall back to Keramos operational data');
assert.equal(mayAccessLegacyOperationalRuntime('',keramos),false,'missing trusted tenant context must fail closed');
console.log('legacy operational boundary tests passed');
