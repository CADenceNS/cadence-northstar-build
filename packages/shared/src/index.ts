export type UserRole = 'administrator' | 'office' | 'cad' | 'ceramics' | 'qc' | 'shipping' | 'billing' | 'sales';
export type CaseStatus = 'received' | 'in-production' | 'qc' | 'ready-to-ship' | 'completed';
export type IntakeType = 'digital' | 'physical' | 'hybrid';
export type WorkflowRoute = 'A' | 'B' | 'C';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface Practice {
  id: string;
  accountNumber: string;
  practiceName: string;
  status: 'active' | 'inactive';
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  taxExempt: boolean;
  scannerType: string;
  createdAt: string;
}

export interface Doctor {
  id: string;
  practiceId: string;
  firstName: string;
  lastName: string;
  specialty: string;
  email: string;
  phone: string;
  active: boolean;
  createdAt: string;
}

export interface LaboratoryCase {
  id: string;
  caseNumber: string;
  practiceId: string;
  doctorId: string;
  patientReference: string;
  restorationType: string;
  toothNumbers: string;
  intakeType: IntakeType;
  route: WorkflowRoute;
  department: string;
  status: CaseStatus;
  receivedDate: string;
  dueDate: string;
  notes: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  casesReceivedToday: number;
  casesDueToday: number;
  casesAtRisk: number;
  casesInQc: number;
  shipmentsReady: number;
  monthRevenue: number;
  activeDoctors: number;
  activePractices: number;
}
