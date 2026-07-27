export type UserRole = 'administrator' | 'office' | 'cad' | 'ceramics' | 'qc' | 'shipping' | 'billing' | 'sales';
export type CaseStatus = 'received' | 'in-production' | 'qc' | 'ready-to-ship' | 'completed';
export type IntakeType = 'digital' | 'physical' | 'hybrid';
export type WorkflowRoute = 'A' | 'B' | 'C';
export type EntityStatus = 'active' | 'inactive';
export type CommunicationType = 'call' | 'email' | 'meeting' | 'note';
export type ArchSelection = 'maxillary' | 'mandibular' | 'both' | 'not-applicable';
export type RushPriority = 'standard' | 'rush';
export type AttachmentKind = 'stl' | 'obj' | 'ply' | 'dicom-cbct' | 'rx' | 'photo';
export type ProductionDepartment = 'receiving' | 'case-review' | 'model' | 'cad' | 'manufacturing' | 'ceramics' | 'qc' | 'shipping';
export type ProductionStatus = 'queued' | 'in-progress' | 'blocked' | 'completed';

export interface User { id: string; name: string; email: string; role: UserRole; active: boolean; }
export interface Contact { name: string; email: string; phone: string; }
export interface CommunicationEntry { id: string; entityType: 'practice' | 'doctor'; entityId: string; type: CommunicationType; summary: string; occurredAt: string; createdBy: string; }
export interface Practice { id:string; accountNumber:string; practiceName:string; status:EntityStatus; phone:string; email:string; address:string; city:string; state:string; postalCode:string; taxExempt:boolean; scannerType:string; officeManager:Contact; notes:string; communicationHistory:CommunicationEntry[]; createdAt:string; updatedAt:string; }
export interface Doctor { id:string; practiceId:string; firstName:string; lastName:string; specialty:string; email:string; phone:string; status:EntityStatus; notes:string; communicationHistory:CommunicationEntry[]; createdAt:string; updatedAt:string; }
export type PracticeInput = Omit<Practice,'id'|'accountNumber'|'communicationHistory'|'createdAt'|'updatedAt'>;
export type DoctorInput = Omit<Doctor,'id'|'communicationHistory'|'createdAt'|'updatedAt'>;
export interface Patient { id:string; practiceId:string; doctorId:string; patientReference:string; firstName:string; lastName:string; dateOfBirth:string; status:EntityStatus; notes:string; createdAt:string; updatedAt:string; }
export type PatientInput = Omit<Patient,'id'|'createdAt'|'updatedAt'>;
export interface CaseAttachment { id:string; caseId:string; kind:AttachmentKind; fileName:string; mimeType:string; size:number; contentBase64:string; uploadedAt:string; }
export interface ClinicalCase { id:string; caseNumber:string; patientId:string; practiceId:string; doctorId:string; status:CaseStatus; toothNumbers:number[]; arch:ArchSelection; restoration:string; material:string; shade:string; stumpShade:string; rushPriority:RushPriority; receivedDate:string; dueDate:string; prescriptionNotes:string; attachments:CaseAttachment[]; createdAt:string; updatedAt:string; }
export type ClinicalCaseInput = Omit<ClinicalCase,'id'|'caseNumber'|'dueDate'|'attachments'|'createdAt'|'updatedAt'>;
export interface AttachmentInput { kind:AttachmentKind; fileName:string; mimeType:string; size:number; contentBase64:string; }

export interface Technician { id:string; name:string; departments:ProductionDepartment[]; status:EntityStatus; }
export interface ProductionHistoryEntry { id:string; workItemId:string; fromDepartment:ProductionDepartment|null; toDepartment:ProductionDepartment; status:ProductionStatus; technicianId:string|null; note:string; occurredAt:string; actorId:string; actorName:string; }
export interface ProductionWorkItem { id:string; caseId:string; caseNumber:string; route:ProductionDepartment[]; currentDepartment:ProductionDepartment; status:ProductionStatus; technicianId:string|null; startedAt:string|null; completedAt:string|null; slaDueAt:string; history:ProductionHistoryEntry[]; createdAt:string; updatedAt:string; }
export interface ProductionWorkItemInput { caseId:string; route:ProductionDepartment[]; technicianId:string|null; actorId:string; actorName:string; }
export interface ProductionTransitionInput { toDepartment:ProductionDepartment; status:ProductionStatus; technicianId:string|null; note:string; actorId:string; actorName:string; }
export interface DepartmentWorkload { department:ProductionDepartment; queued:number; inProgress:number; blocked:number; overdue:number; total:number; }

export interface LaboratoryCase { id:string; caseNumber:string; practiceId:string; doctorId:string; patientReference:string; restorationType:string; toothNumbers:string; intakeType:IntakeType; route:WorkflowRoute; department:string; status:CaseStatus; receivedDate:string; dueDate:string; notes:string; createdAt:string; }
export interface AuditEvent { id:string; actor:string; action:string; entityType:string; entityId:string; createdAt:string; }
export interface DashboardSnapshot { generatedAt:string; casesReceivedToday:number; casesDueToday:number; casesAtRisk:number; casesInQc:number; shipmentsReady:number; monthRevenue:number; activeDoctors:number; activePractices:number; activePatients:number; openCases:number; rushCases:number; productionOverdue:number; productionInProgress:number; departmentWorkload:DepartmentWorkload[]; }
