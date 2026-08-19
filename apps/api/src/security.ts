import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions
} from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import type { User } from '@northstar/shared';
import type { AuditRepository, RepositoryContext, UserRepository } from './infrastructure/contracts.js';
import { tenantHasOperationalAccess, type MembershipStatus, type PlatformRole, type TenantActivationState, type TenantStatus } from './infrastructure/tenant-native.js';

const SESSION_COOKIE = 'northstar.sid';
const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const RENEWAL_WINDOW_MS = 10 * 60 * 1000;
const MAX_CONCURRENT_SESSIONS = 5;
const LOCK_THRESHOLD = 5;
const LOCK_MS = 15 * 60 * 1000;

export type NorthStarRole =
  | 'system-administrator'
  | 'laboratory-administrator'
  | 'office-manager'
  | 'customer-service'
  | 'cad-technician'
  | 'production-technician'
  | 'ceramist'
  | 'qc-technician'
  | 'shipping'
  | 'billing'
  | 'sales'
  | 'doctor'
  | 'read-only-auditor';

export interface RequestIdentity {
  userId: string;
  name: string;
  email: string;
  role: NorthStarRole;
  tenantId: string;
  locationIds: string[];
  practiceIds: string[];
  administrativeOverride: boolean;
  sessionId: string;
  csrfToken: string;
  platformRole?: PlatformRole;
  tenantStatus?: TenantStatus;
  activationState?: TenantActivationState;
  membershipStatus?: MembershipStatus;
}

export interface SecurityRequest extends Request {
  identity?: RequestIdentity;
}

type SessionRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  csrf_hash: string;
  role: NorthStarRole;
  location_ids: string[];
  practice_ids: string[];
  administrative_override: boolean;
  idle_expires_at: Date;
  absolute_expires_at: Date;
  revoked_at: Date | null;
  platform_role: PlatformRole;
};

type MembershipRow = {
  role: NorthStarRole;
  location_ids: string[];
  practice_ids: string[];
  administrative_override: boolean;
  membership_status: MembershipStatus;
  platform_role: PlatformRole;
};

type AuthenticationCandidate = {
  user_id:string;
  tenant_id:string;
  email:string;
  name:string;
  role:NorthStarRole;
  active:boolean;
  password_hash:string;
  failed_attempts:number;
  locked_until:Date|null;
  membership_role:NorthStarRole;
  location_ids:string[];
  practice_ids:string[];
  administrative_override:boolean;
  membership_status:MembershipStatus;
  platform_role:PlatformRole;
  tenant_status:TenantStatus;
  activation_state:TenantActivationState;
};

type ActiveMembershipRow = {
  role:NorthStarRole;
  location_ids:string[];
  practice_ids:string[];
  administrative_override:boolean;
  membership_status:MembershipStatus;
  platform_role:PlatformRole;
  tenant_status:TenantStatus;
  activation_state:TenantActivationState;
};

type Permission =
  | 'dashboard.read'
  | 'practice.read'
  | 'practice.manage'
  | 'doctor.read'
  | 'doctor.manage'
  | 'patient.read'
  | 'patient.manage'
  | 'case.read'
  | 'case.manage'
  | 'production.read'
  | 'production.manage'
  | 'qc.read'
  | 'qc.manage'
  | 'shipping.read'
  | 'shipping.manage'
  | 'billing.read'
  | 'billing.manage'
  | 'audit.read';

const allPermissions: Permission[] = [
  'dashboard.read', 'practice.read', 'practice.manage', 'doctor.read', 'doctor.manage',
  'patient.read', 'patient.manage', 'case.read', 'case.manage', 'production.read',
  'production.manage', 'qc.read', 'qc.manage', 'shipping.read', 'shipping.manage',
  'billing.read', 'billing.manage', 'audit.read'
];

const permissionMatrix: Record<NorthStarRole, ReadonlySet<Permission>> = {
  'system-administrator': new Set(allPermissions),
  'laboratory-administrator': new Set(allPermissions),
  'office-manager': new Set(['dashboard.read', 'practice.read', 'doctor.read', 'patient.read', 'patient.manage', 'case.read', 'case.manage', 'production.read', 'qc.read', 'shipping.read', 'billing.read']),
  'customer-service': new Set(['dashboard.read', 'practice.read', 'doctor.read', 'patient.read', 'patient.manage', 'case.read', 'case.manage', 'production.read', 'qc.read', 'shipping.read']),
  'cad-technician': new Set(['dashboard.read', 'practice.read', 'doctor.read', 'patient.read', 'case.read', 'production.read', 'production.manage', 'qc.read']),
  'production-technician': new Set(['dashboard.read', 'case.read', 'production.read', 'production.manage', 'qc.read']),
  'ceramist': new Set(['dashboard.read', 'case.read', 'production.read', 'production.manage', 'qc.read']),
  'qc-technician': new Set(['dashboard.read', 'practice.read', 'doctor.read', 'patient.read', 'case.read', 'production.read', 'qc.read', 'qc.manage', 'shipping.read']),
  'shipping': new Set(['dashboard.read', 'practice.read', 'doctor.read', 'patient.read', 'case.read', 'production.read', 'qc.read', 'shipping.read', 'shipping.manage']),
  'billing': new Set(['dashboard.read', 'practice.read', 'doctor.read', 'patient.read', 'case.read', 'shipping.read', 'billing.read', 'billing.manage']),
  'sales': new Set(['dashboard.read', 'practice.read', 'practice.manage', 'doctor.read', 'doctor.manage', 'patient.read', 'case.read', 'billing.read']),
  'doctor': new Set(['dashboard.read', 'practice.read', 'doctor.read', 'patient.read', 'case.read']),
  'read-only-auditor': new Set(['dashboard.read', 'practice.read', 'doctor.read', 'patient.read', 'case.read', 'production.read', 'qc.read', 'shipping.read', 'billing.read', 'audit.read'])
};

const roleAliases: Record<string, NorthStarRole> = {
  administrator: 'system-administrator',
  'system administrator': 'system-administrator',
  'laboratory administrator': 'laboratory-administrator'
};

const normalizeRole = (value: string): NorthStarRole =>
  roleAliases[value.toLowerCase()] ?? value.toLowerCase().replaceAll(' ', '-') as NorthStarRole;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const now = () => new Date();
const iso = () => now().toISOString();
const derivePassword = (password: string, salt: Buffer, length: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, length, options, (error, key) => error ? reject(error) : resolve(key as Buffer)));

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await derivePassword(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString('base64')}$${derived.toString('base64')}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [algorithm, n, r, p, saltValue, hashValue] = encoded.split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, 'base64');
  const actual = await derivePassword(password, Buffer.from(saltValue, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function parseCookies(req: Request) {
  const result: Record<string, string> = {};
  for (const part of (req.header('cookie') ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

function cookie(value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

function requestIp(req: Request) {
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.socket.remoteAddress || null;
}

function originAllowed(req: Request) {
  const origin = req.header('origin');
  if (!origin) return true;
  try {
    const configured = process.env.NORTHSTAR_PUBLIC_ORIGIN;
    if (configured && new URL(configured).origin === new URL(origin).origin) return true;
    const forwardedHost = req.header('x-forwarded-host')?.split(',')[0]?.trim();
    const requestHost = req.header('host')?.trim();
    const originHost = new URL(origin).host;
    return [forwardedHost, requestHost].filter(Boolean).includes(originHost);
  } catch {
    return false;
  }
}

function requiredPermission(req: Request): Permission | null {
  const path = req.path;
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (path === '/api/dashboard') return 'dashboard.read';
  if (path.startsWith('/api/practices')) return write ? 'practice.manage' : 'practice.read';
  if (path.startsWith('/api/doctors')) return write ? 'doctor.manage' : 'doctor.read';
  if (path.startsWith('/api/patients')) return write ? 'patient.manage' : 'patient.read';
  if (path.startsWith('/api/cases')) return write ? 'case.manage' : 'case.read';
  if (path.startsWith('/api/production')) return write ? 'production.manage' : 'production.read';
  if (path.startsWith('/api/qc')) return write ? 'qc.manage' : 'qc.read';
  if (path.startsWith('/api/shipping')) return write ? 'shipping.manage' : 'shipping.read';
  if (path.startsWith('/api/billing')) return write ? 'billing.manage' : 'billing.read';
  if (path.startsWith('/api/audit')) return 'audit.read';
  return null;
}

function scopedPracticeId(req: Request) {
  return text(req.params.practiceId)
    || text(req.params.id && req.path.startsWith('/api/practices/') ? req.params.id : '')
    || text(req.query.practiceId)
    || text(req.body?.practiceId);
}

export class SecurityService {
  constructor(
    private readonly pool: Pool,
    private readonly users: UserRepository,
    private readonly auditRepository: AuditRepository,
    private readonly context: RepositoryContext
  ) {}

  private async audit(
    action: string,
    result: 'success' | 'failure',
    req: Request,
    identity: Partial<RequestIdentity>,
    metadata: Record<string, unknown> = {}
  ) {
    await this.auditRepository.append({
      tenantId: identity.tenantId ?? this.context.tenantId,
      actorId: identity.userId ?? 'anonymous',
      actorName: identity.name ?? 'Anonymous',
      action,
      entityType: 'security',
      entityId: identity.sessionId ?? identity.userId ?? randomUUID(),
      occurredAt: iso(),
      metadata: {
        result,
        role: identity.role ?? 'anonymous',
        ipAddress: requestIp(req),
        userAgent: req.header('user-agent') ?? '',
        ...metadata
      }
    });
  }

  async bootstrap() {
    const user = await this.users.get(this.context, 'usr-admin');
    if (!user) return;
    const role = normalizeRole(user.role);
    await this.pool.query(
      `INSERT INTO identity_memberships(tenant_id,user_id,role,location_ids,practice_ids,administrative_override)
       VALUES($1,$2,$3,$4,$5,true)
       ON CONFLICT(tenant_id,user_id) DO UPDATE
       SET role=EXCLUDED.role,administrative_override=true,updated_at=now()`,
      [this.context.tenantId, user.id, role, ['location-primary'], []]
    );
    const existing = await this.pool.query(
      'SELECT 1 FROM identity_credentials WHERE tenant_id=$1 AND user_id=$2',
      [this.context.tenantId, user.id]
    );
    if (!existing.rowCount) {
      const password = process.env.NORTHSTAR_BOOTSTRAP_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'NorthStar!2026');
      if (!password) throw new Error('NORTHSTAR_BOOTSTRAP_PASSWORD is required in production.');
      await this.pool.query(
        `INSERT INTO identity_credentials(tenant_id,user_id,password_hash,email_verified_at)
         VALUES($1,$2,$3,now())`,
        [this.context.tenantId, user.id, await hashPassword(password)]
      );
    }
  }

  private async membership(userId: string) {
    const result = await this.pool.query<MembershipRow>(
      'SELECT role,location_ids,practice_ids,administrative_override,membership_status,platform_role FROM identity_memberships WHERE tenant_id=$1 AND user_id=$2',
      [this.context.tenantId, userId]
    );
    return result.rows[0] ?? null;
  }

  private async findAuthenticationCandidates(email:string) {
    const result=await this.pool.query<AuthenticationCandidate>(`
      WITH repository_identity AS (
        SELECT d.entity_id AS user_id,d.tenant_id::text AS tenant_id,
          lower(d.payload->>'email') AS email,d.payload->>'name' AS name,
          d.payload->>'role' AS role,COALESCE((d.payload->>'active')::boolean,true) AS active
        FROM repository_documents d
        WHERE d.entity_type='user' AND d.deleted_at IS NULL AND lower(d.payload->>'email')=lower($1)
      ), raw_identity AS (
        SELECT u.id::text AS user_id,u.tenant_id::text AS tenant_id,lower(u.email::text) AS email,u.name,u.role,u.active
        FROM users u
        WHERE u.deleted_at IS NULL AND lower(u.email::text)=lower($1)
          AND NOT EXISTS(SELECT 1 FROM repository_documents d WHERE d.tenant_id=u.tenant_id AND d.entity_type='user' AND d.entity_id=u.id::text AND d.deleted_at IS NULL)
      ), identities AS (SELECT * FROM repository_identity UNION ALL SELECT * FROM raw_identity)
      SELECT i.user_id,i.tenant_id,i.email,i.name,i.role::text AS role,i.active,c.password_hash,c.failed_attempts,c.locked_until,
        m.role AS membership_role,m.location_ids,m.practice_ids,m.administrative_override,m.membership_status,m.platform_role,
        t.status AS tenant_status,t.activation_state
      FROM identities i
      JOIN identity_credentials c ON c.tenant_id=i.tenant_id::uuid AND c.user_id=i.user_id
      JOIN identity_memberships m ON m.tenant_id=i.tenant_id::uuid AND m.user_id=i.user_id
      JOIN tenants t ON t.id=i.tenant_id::uuid AND t.deleted_at IS NULL
      ORDER BY i.tenant_id
      LIMIT 2`,[email]);
    return result.rows;
  }

  private async loadUser(tenantId:string,userId:string):Promise<User|null>{
    const repositoryUser=await this.users.get({...this.context,tenantId},userId);
    if(repositoryUser)return repositoryUser;
    const result=await this.pool.query<{id:string;name:string;email:string;role:string;active:boolean}>('SELECT id::text,name,email::text,role,active FROM users WHERE tenant_id=$1 AND id::text=$2 AND deleted_at IS NULL',[tenantId,userId]);
    const row=result.rows[0];
    return row?{id:row.id,name:row.name,email:row.email,role:row.role as User['role'],active:row.active}:null;
  }

  async login(req: Request, res: Response) {
    const email = text(req.body?.email).toLowerCase();
    const password = text(req.body?.password);
    const candidates=email?await this.findAuthenticationCandidates(email):[];
    if(candidates.length!==1||!candidates[0].active){
      await this.audit('authentication.login', 'failure', req, {}, { reason: 'invalid-or-ambiguous-identity' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user=candidates[0];
    if(user.locked_until&&user.locked_until.getTime()>Date.now()){
      await this.audit('authentication.login', 'failure', req, {userId:user.user_id,name:user.name,tenantId:user.tenant_id,role:user.membership_role}, { reason: 'account-locked' });
      return res.status(423).json({ error: 'Account is temporarily locked.' });
    }
    if(!await verifyPassword(password,user.password_hash)){
      const attempts=user.failed_attempts+1;
      const lockedUntil = attempts >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_MS) : null;
      await this.pool.query(
        'UPDATE identity_credentials SET failed_attempts=$3,locked_until=$4,updated_at=now() WHERE tenant_id=$1 AND user_id=$2',
        [user.tenant_id,user.user_id,attempts,lockedUntil]
      );
      await this.audit('authentication.login', 'failure', req, {userId:user.user_id,name:user.name,tenantId:user.tenant_id,role:user.membership_role}, { reason: 'invalid-credentials', failedAttempts: attempts });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if(user.membership_status!=='ACTIVE'||!tenantHasOperationalAccess({status:user.tenant_status,activationState:user.activation_state})){
      await this.audit('authentication.login', 'failure', req, {userId:user.user_id,name:user.name,tenantId:user.tenant_id,role:user.membership_role}, {reason:'tenant-or-membership-inactive'});
      return res.status(403).json({ error: 'Tenant operational access is unavailable.' });
    }
    await this.pool.query(
      'UPDATE identity_credentials SET failed_attempts=0,locked_until=NULL,updated_at=now() WHERE tenant_id=$1 AND user_id=$2',
      [user.tenant_id,user.user_id]
    );
    await this.pool.query(
      `UPDATE identity_sessions SET revoked_at=now(),revoked_reason='concurrent-session-limit'
       WHERE id IN (
         SELECT id FROM identity_sessions
         WHERE tenant_id=$1 AND user_id=$2 AND revoked_at IS NULL
         ORDER BY last_seen_at DESC OFFSET $3
       )`,
      [user.tenant_id,user.user_id,MAX_CONCURRENT_SESSIONS-1]
    );
    const token = randomBytes(32).toString('base64url');
    const csrf = randomBytes(24).toString('base64url');
    const sessionId = randomUUID();
    const created = Date.now();
    await this.pool.query(
      `INSERT INTO identity_sessions(
         id,tenant_id,user_id,token_hash,csrf_hash,role,location_ids,practice_ids,
         administrative_override,platform_role,ip_address,user_agent,idle_expires_at,absolute_expires_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        sessionId,user.tenant_id,user.user_id,sha256(token),sha256(csrf),user.membership_role,
        user.location_ids,user.practice_ids,user.administrative_override,user.platform_role,
        requestIp(req),req.header('user-agent')??'',new Date(created+IDLE_MS),new Date(created+ABSOLUTE_MS)
      ]
    );
    res.setHeader('Set-Cookie', cookie(token, Math.floor(ABSOLUTE_MS / 1000)));
    res.setHeader('X-CSRF-Token', csrf);
    const responseUser={id:user.user_id,name:user.name,email:user.email,role:user.membership_role,active:true};
    await this.audit('authentication.login', 'success', req, {
      userId: user.user_id,
      name: user.name,
      email: user.email,
      role: user.membership_role,
      tenantId: user.tenant_id,
      sessionId
    }, { sessionId,platformRole:user.platform_role });
    return res.json({ user: responseUser, csrfToken: csrf, expiresAt: new Date(created + IDLE_MS).toISOString() });
  }

  async authenticate(req: SecurityRequest, res: Response, next: NextFunction) {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const result = await this.pool.query<SessionRow>(
      `SELECT id,tenant_id,user_id,csrf_hash,role,location_ids,practice_ids,
              administrative_override,platform_role,idle_expires_at,absolute_expires_at,revoked_at
       FROM identity_sessions WHERE token_hash=$1`,
      [sha256(token)]
    );
    const session = result.rows[0];
    if (!session || session.revoked_at || session.idle_expires_at.getTime() <= Date.now() || session.absolute_expires_at.getTime() <= Date.now()) {
      res.setHeader('Set-Cookie', clearCookie());
      return res.status(401).json({ error: 'Session expired.' });
    }
    const membership=await this.pool.query<ActiveMembershipRow>(`SELECT m.role,m.location_ids,m.practice_ids,m.administrative_override,m.membership_status,m.platform_role,t.status AS tenant_status,t.activation_state
      FROM identity_memberships m JOIN tenants t ON t.id=m.tenant_id AND t.deleted_at IS NULL
      WHERE m.tenant_id=$1 AND m.user_id=$2`,[session.tenant_id,session.user_id]);
    const currentMembership=membership.rows[0];
    if(!currentMembership||currentMembership.membership_status!=='ACTIVE'||!tenantHasOperationalAccess({status:currentMembership.tenant_status,activationState:currentMembership.activation_state})){
      await this.pool.query("UPDATE identity_sessions SET revoked_at=now(),revoked_reason='tenant-or-membership-inactive' WHERE id=$1",[session.id]);
      res.setHeader('Set-Cookie', clearCookie());
      return res.status(403).json({error:'Tenant operational access is unavailable.'});
    }
    const user = await this.loadUser(session.tenant_id,session.user_id);
    if (!user || !user.active) return res.status(401).json({ error: 'Authentication required.' });
    const csrf = text(req.header('x-csrf-token'));
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.path !== '/api/auth/logout') {
      if (!originAllowed(req) || !csrf || sha256(csrf) !== session.csrf_hash) {
        await this.audit('authorization.csrf', 'failure', req, {
          userId: user.id,
          name: user.name,
          role: session.role,
          tenantId: session.tenant_id,
          sessionId: session.id
        }, { path: req.path });
        return res.status(403).json({ error: 'CSRF validation failed.' });
      }
    }
    req.identity = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: currentMembership.role,
      tenantId: session.tenant_id,
      locationIds: currentMembership.location_ids ?? [],
      practiceIds: currentMembership.practice_ids ?? [],
      administrativeOverride: currentMembership.administrative_override,
      sessionId: session.id,
      csrfToken: csrf,
      platformRole: currentMembership.platform_role,
      tenantStatus: currentMembership.tenant_status,
      activationState: currentMembership.activation_state,
      membershipStatus: currentMembership.membership_status
    };
    const nextIdle = new Date(Math.min(Date.now() + IDLE_MS, session.absolute_expires_at.getTime()));
    await this.pool.query(
      'UPDATE identity_sessions SET last_seen_at=now(),idle_expires_at=$2 WHERE id=$1',
      [session.id, nextIdle]
    );
    if (nextIdle.getTime() - Date.now() < RENEWAL_WINDOW_MS) {
      res.setHeader('X-Session-Expires-At', nextIdle.toISOString());
    }
    return next();
  }

  async authorize(req: SecurityRequest, res: Response, next: NextFunction) {
    const identity = req.identity;
    if (!identity) return res.status(401).json({ error: 'Authentication required.' });
    const permission = requiredPermission(req);
    if(identity.platformRole==='platform-admin'){
      await this.audit('authorization.denied','failure',req,identity,{reason:'platform-admin-has-no-tenant-operational-context',path:req.path,method:req.method});
      return res.status(403).json({error:'Platform administrators do not have tenant operational access.'});
    }
    if (permission && !permissionMatrix[identity.role]?.has(permission)) {
      await this.audit('authorization.denied', 'failure', req, identity, { permission, path: req.path, method: req.method });
      return res.status(403).json({ error: 'Permission denied.' });
    }
    const practiceId = scopedPracticeId(req);
    if (practiceId && !identity.administrativeOverride && identity.practiceIds.length > 0 && !identity.practiceIds.includes(practiceId)) {
      await this.audit('authorization.scope.denied', 'failure', req, identity, { practiceId, path: req.path });
      return res.status(403).json({ error: 'Practice access denied.' });
    }
    return next();
  }

  async session(req: SecurityRequest, res: Response) {
    const identity = req.identity!;
    const user = await this.loadUser(identity.tenantId, identity.userId);
    const csrfToken = randomBytes(24).toString('base64url');
    await this.pool.query(
      'UPDATE identity_sessions SET csrf_hash=$2,last_seen_at=now() WHERE id=$1 AND revoked_at IS NULL',
      [identity.sessionId, sha256(csrfToken)]
    );
    res.setHeader('X-CSRF-Token', csrfToken);
    return res.json({
      user: user ? { ...user, role: identity.role } : null,
      csrfToken,
      session: {
        id: identity.sessionId,
        role: identity.role,
        tenantId: identity.tenantId,
        platformRole: identity.platformRole ?? 'none',
        locationIds: identity.locationIds,
        practiceIds: identity.practiceIds
      }
    });
  }

  async logout(req: SecurityRequest, res: Response) {
    const identity = req.identity;
    if (identity) {
      await this.pool.query(
        `UPDATE identity_sessions SET revoked_at=now(),revoked_reason='logout' WHERE id=$1`,
        [identity.sessionId]
      );
      await this.audit('authentication.logout', 'success', req, identity, { sessionId: identity.sessionId });
    }
    res.setHeader('Set-Cookie', clearCookie());
    return res.status(204).send();
  }

  async auditMutation(req: SecurityRequest, res: Response, next: NextFunction) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    res.on('finish', () => {
      const identity = req.identity;
      if (!identity) return;
      void this.audit('security.request', 'success', req, identity, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode
      });
    });
    return next();
  }
}

export async function installSecurity(app: Express, service: SecurityService, options:{beforeAuthorize?:(app:Express)=>void|Promise<void>}={}) {
  await service.bootstrap();
  app.post('/api/auth/login', (req, res) => void service.login(req, res));
  app.use((req: SecurityRequest, res, next) => void service.authenticate(req, res, next));
  app.get('/api/auth/session', (req: SecurityRequest, res) => void service.session(req, res));
  app.post('/api/auth/logout', (req: SecurityRequest, res) => void service.logout(req, res));
  await options.beforeAuthorize?.(app);
  app.use((req: SecurityRequest, res, next) => void service.authorize(req, res, next));
  app.use((req: SecurityRequest, res, next) => void service.auditMutation(req, res, next));
}
