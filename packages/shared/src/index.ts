export type UserRole = 'administrator' | 'office' | 'cad' | 'ceramics' | 'qc' | 'shipping' | 'billing' | 'sales';
export type CaseStatus = 'received' | 'in-production' | 'qc' | 'ready-to-ship' | 'completed';
export type IntakeType = 'digital' | 'physical' | 'hybrid';
export type WorkflowRoute = 'A' | 'B' | 'C';
export type EntityStatus = 'active' | 'inactive';
export type CommunicationType = 'call' | 'email' | 'meeting' | 'note';

export interface User { id: string; name: string; email: string; role: UserRole; active: boolean; }
export interface Contact { name: string; email: string; phone: string; }
export interface CommunicationEntry { id: string; entityType: 'practice' | 'doctor'; entityId: string; type: CommunicationType; summary: string; occurredAt: string; createdBy: string; }

export interface Practice {
  id: string;
  accountNumber: string;
  practiceName: string;
  status: EntityStatus;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  taxExempt: boolean;
  scannerType: string;
  officeManager: Contact;
  notes: string;
  communicationHistory: CommunicationEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  practiceId: string;
  firstName: string;
  lastName: string;
  specialty: string;
  email: string;
  phone: string;
  status: EntityStatus;
  notes: string;
  communicationHistory: CommunicationEntry[];
  createdAt: string;
  updatedAt: string;
}

export type PracticeInput = Omit<Practice, 'id' | 'accountNumber' | 'communicationHistory' | 'createdAt' | 'updatedAt'>;
export type DoctorInput = Omit<Doctor, 'id' | 'communicationHistory' | 'createdAt' | 'updatedAt'>;

export interface LaboratoryCase { id: string; caseNumber: string; practiceId: string; doctorId: string; patientReference: string; restorationType: string; toothNumbers: string; intakeType: IntakeType; route: WorkflowRoute; department: string; status: CaseStatus; receivedDate: string; dueDate: string; notes: string; createdAt: string; }
export interface AuditEvent { id: string; actor: string; action: string; entityType: string; entityId: string; createdAt: string; }
export interface DashboardSnapshot { generatedAt: string; casesReceivedToday: number; casesDueToday: number; casesAtRisk: number; casesInQc: number; shipmentsReady: number; monthRevenue: number; activeDoctors: number; activePractices: number; }