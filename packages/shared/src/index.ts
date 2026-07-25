export type DepartmentStatus = 'healthy' | 'attention' | 'blocked';

export interface DepartmentSnapshot {
  name: string;
  activeCases: number;
  status: DepartmentStatus;
}

export interface DashboardSnapshot {
  generatedAt: string;
  casesReceivedToday: number;
  casesDueToday: number;
  casesAtRisk: number;
  casesInQc: number;
  shipmentsReady: number;
  monthRevenue: number;
  departments: DepartmentSnapshot[];
}

export interface DoctorAccount {
  id: string;
  accountNumber: string;
  doctorName: string;
  practiceName: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'prospect';
}

export interface LaboratoryCase {
  id: string;
  caseNumber: string;
  doctorId: string;
  patientReference: string;
  department: string;
  restorationType: string;
  dueDate: string;
  status: 'received' | 'in-production' | 'qc' | 'ready-to-ship' | 'completed';
}
