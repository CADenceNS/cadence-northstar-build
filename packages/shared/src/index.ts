export type UserRole = 'administrator' | 'office' | 'cad' | 'ceramics' | 'qc' | 'shipping' | 'billing' | 'sales';
export type CaseStatus = 'received' | 'in-production' | 'qc' | 'ready-to-ship' | 'completed';
export type IntakeType = 'digital' | 'physical' | 'hybrid';
export type WorkflowRoute = 'A' | 'B' | 'C';
export type EntityStatus = 'active' | 'inactive';
export type CommunicationType = 'call' | 'email' | 'meeting' | 'note';
export type ArchSelection = 'maxillary' | 'mandibular' | 'both' | 'not-applicable';
export type RushPriority = 'standard' | 'rush';
export type CaseRelationship = 'NEW' | 'REMAKE' | 'REPAIR' | 'CONTINUATION';
export type CaseResponsibility = 'LABORATORY' | 'DOCTOR_PRACTICE' | 'SHARED' | 'PATIENT_EXTERNAL' | 'OTHER_REQUIRES_REVIEW';
export type ContinuationOperationalState = 'AWAITING_CLINICAL_TRY_IN' | 'AWAITING_RETURN' | 'CONTINUATION_RECEIVED' | 'WORK_RESUMED';
export type ContinuationBillingPolicyType = 'BILL_AT_FINAL_COMPLETION' | 'BILL_BY_MILESTONE' | 'BILL_EVERY_CONTINUATION' | 'HYBRID';
export type AttachmentKind = 'stl' | 'obj' | 'ply' | 'dicom-cbct' | 'rx' | 'photo';
export type ProductionDepartment = 'receiving' | 'case-review' | 'model' | 'cad' | 'manufacturing' | 'ceramics' | 'qc' | 'shipping';
export type ProductionStatus = 'queued' | 'in-progress' | 'blocked' | 'completed';
export type QCOutcome = 'pass' | 'rework' | 'hold' | 'remake' | 'doctor-clarification';
export type QCDefectCategory = 'fit' | 'contacts' | 'occlusion' | 'margin' | 'anatomy' | 'shade' | 'surface' | 'material' | 'implant-interface' | 'prescription' | 'other';
export type QCChecklistResult = 'pass' | 'fail' | 'not-applicable';
export type ShipmentStatus = 'ready-to-ship' | 'awaiting-pickup' | 'shipped' | 'delivered';
export type Courier = 'local-delivery' | 'ups' | 'fedex' | 'usps' | 'dhl' | 'other';
export type InvoiceStatus = 'draft' | 'open' | 'partially-paid' | 'paid' | 'void';
export type PaymentMethod = 'ach' | 'check' | 'credit-card' | 'cash' | 'other';
export type PaymentTerms = 'due-on-receipt' | 'net-15' | 'net-30' | 'net-45';

export interface User { id:string; name:string; email:string; role:UserRole; active:boolean; }
export interface Contact { name:string; email:string; phone:string; }
export interface CommunicationEntry { id:string; entityType:'practice'|'doctor'; entityId:string; type:CommunicationType; summary:string; occurredAt:string; createdBy:string; }
export interface Practice { id:string; accountNumber:string; practiceName:string; status:EntityStatus; phone:string; email:string; address:string; city:string; state:string; postalCode:string; taxExempt:boolean; scannerType:string; officeManager:Contact; notes:string; communicationHistory:CommunicationEntry[]; createdAt:string; updatedAt:string; }
export interface Doctor { id:string; practiceId:string; firstName:string; lastName:string; specialty:string; email:string; phone:string; status:EntityStatus; notes:string; communicationHistory:CommunicationEntry[]; createdAt:string; updatedAt:string; }
export type PracticeInput = Omit<Practice,'id'|'accountNumber'|'communicationHistory'|'createdAt'|'updatedAt'>;
export type DoctorInput = Omit<Doctor,'id'|'communicationHistory'|'createdAt'|'updatedAt'>;
export interface Patient { id:string; practiceId:string; doctorId:string; patientReference:string; firstName:string; lastName:string; dateOfBirth:string; status:EntityStatus; notes:string; createdAt:string; updatedAt:string; }
export type PatientInput = Omit<Patient,'id'|'createdAt'|'updatedAt'>;
export interface CaseAttachment { id:string; caseId:string; kind:AttachmentKind; fileName:string; mimeType:string; size:number; contentBase64:string; uploadedAt:string; }
export interface CaseJourneyResponsibility { responsibilityCategory:CaseResponsibility; clinicPercentage:string; labPercentage:string; confirmedBy:string; confirmedAt:string; notes:string; evidenceReferences:string[]; }
export type CaseJourneyResponsibilityInput=Omit<CaseJourneyResponsibility,'confirmedBy'|'confirmedAt'>;
export interface CaseJourneyReason { id:string; code:string; category:string; label:string; active:boolean; suggestedResponsibility:CaseResponsibility|null; }
export interface ContinuationStage { id:string; code:string; label:string; active:boolean; }
export interface ContinuationBillingPolicy { id:string; policyType:ContinuationBillingPolicyType; label:string; active:boolean; isDefault:boolean; metadata:Record<string,unknown>; }
export interface ClinicalCase { id:string; caseNumber:string; patientId:string; practiceId:string; doctorId:string; status:CaseStatus; toothNumbers:number[]; arch:ArchSelection; restoration:string; material:string; shade:string; stumpShade:string; rushPriority:RushPriority; receivedDate:string; dueDate:string; prescriptionNotes:string; attachments:CaseAttachment[]; createdAt:string; updatedAt:string; caseRelationship?:CaseRelationship; journeyAvailable?:boolean; rootCaseId?:string; parentCaseId?:string|null; remakeRepairReasonId?:string|null; continuationStageId?:string|null; continuationOperationalState?:ContinuationOperationalState|null; continuationBillingPolicyId?:string|null; responsibility?:CaseJourneyResponsibility|CaseJourneyResponsibilityInput|null; }
export type ClinicalCaseInput = Omit<ClinicalCase,'id'|'caseNumber'|'dueDate'|'attachments'|'createdAt'|'updatedAt'|'responsibility'|'journeyAvailable'>&{responsibility?:CaseJourneyResponsibilityInput|null};
export interface AttachmentInput { kind:AttachmentKind; fileName:string; mimeType:string; size:number; contentBase64:string; }
export interface Technician { id:string; name:string; departments:ProductionDepartment[]; status:EntityStatus; }
export interface ProductionHistoryEntry { id:string; workItemId:string; fromDepartment:ProductionDepartment|null; toDepartment:ProductionDepartment; status:ProductionStatus; technicianId:string|null; note:string; occurredAt:string; actorId:string; actorName:string; }
export interface ProductionWorkItem { id:string; caseId:string; caseNumber:string; route:ProductionDepartment[]; currentDepartment:ProductionDepartment; status:ProductionStatus; technicianId:string|null; startedAt:string|null; completedAt:string|null; slaDueAt:string; history:ProductionHistoryEntry[]; createdAt:string; updatedAt:string; }
export interface ProductionWorkItemInput { caseId:string; route:ProductionDepartment[]; technicianId:string|null; actorId:string; actorName:string; }
export interface ProductionTransitionInput { toDepartment:ProductionDepartment; status:ProductionStatus; technicianId:string|null; note:string; actorId:string; actorName:string; }
export interface DepartmentWorkload { department:ProductionDepartment; queued:number; inProgress:number; blocked:number; overdue:number; total:number; }
export interface QCChecklistItem { id:string; label:string; required:boolean; defectCategory:QCDefectCategory; sortOrder:number; }
export interface QCTemplate { id:string; name:string; restorationTypes:string[]; status:EntityStatus; checklistItems:QCChecklistItem[]; createdAt:string; updatedAt:string; }
export interface QCTemplateInput { name:string; restorationTypes:string[]; status:EntityStatus; checklistItems:Array<Omit<QCChecklistItem,'id'>>; }
export interface QCInspectionItem { checklistItemId:string; label:string; result:QCChecklistResult; note:string; defectCategory:QCDefectCategory; }
export interface QCDefect { id:string; category:QCDefectCategory; description:string; severity:'minor'|'major'|'critical'; }
export interface QCPhoto { id:string; inspectionId:string; fileName:string; mimeType:string; size:number; contentBase64:string; uploadedAt:string; uploadedBy:string; }
export interface QCInspectionHistoryEntry { id:string; inspectionId:string; action:string; outcome:QCOutcome|null; note:string; actorId:string; actorName:string; occurredAt:string; }
export interface QCInspection { id:string; caseId:string; caseNumber:string; templateId:string; restorationType:string; outcome:QCOutcome; checklist:QCInspectionItem[]; defects:QCDefect[]; photos:QCPhoto[]; inspectorId:string; inspectorName:string; signedAt:string; notes:string; history:QCInspectionHistoryEntry[]; createdAt:string; updatedAt:string; }
export interface QCInspectionInput { caseId:string; templateId:string; outcome:QCOutcome; checklist:QCInspectionItem[]; defects:Array<Omit<QCDefect,'id'>>; inspectorId:string; inspectorName:string; notes:string; }
export interface QCPhotoInput { fileName:string; mimeType:string; size:number; contentBase64:string; uploadedBy:string; }
export interface QCMetrics { totalInspections:number; passRate:number; remakeRate:number; reworkRate:number; firstPassYield:number; outcomeCounts:Record<QCOutcome,number>; defectTrends:Array<{category:QCDefectCategory;count:number}>; }
export interface PackingChecklistItem { id:string; label:string; required:boolean; completed:boolean; }
export interface ShipmentHistoryEntry { id:string; shipmentId:string; fromStatus:ShipmentStatus|null; toStatus:ShipmentStatus; note:string; actorId:string; actorName:string; occurredAt:string; }
export interface Shipment { id:string; shipmentNumber:string; barcodeValue:string; caseIds:string[]; caseNumbers:string[]; status:ShipmentStatus; courier:Courier; courierName:string; trackingNumber:string; pickupScheduledAt:string|null; shippedAt:string|null; deliveredAt:string|null; packingChecklist:PackingChecklistItem[]; notes:string; history:ShipmentHistoryEntry[]; createdBy:string; createdAt:string; updatedAt:string; }
export interface ShipmentInput { caseIds:string[]; courier:Courier; courierName:string; trackingNumber:string; packingChecklist:Array<Omit<PackingChecklistItem,'id'>>; notes:string; actorId:string; actorName:string; }
export interface ShipmentTransitionInput { status:ShipmentStatus; trackingNumber:string; note:string; actorId:string; actorName:string; occurredAt:string; }
export interface LogisticsMetrics { readyToShip:number; awaitingPickup:number; shipped:number; delivered:number; totalShipments:number; deliveredOnTime:number; }
export interface InvoiceLine { id:string; caseId:string; caseNumber:string; description:string; quantity:number; unitPrice:number; amount:number; }
export interface InvoiceAdjustment { id:string; type:'discount'|'fee'|'credit'; description:string; amount:number; createdBy:string; createdAt:string; }
export interface Payment { id:string; invoiceId:string; amount:number; method:PaymentMethod; reference:string; receivedAt:string; recordedBy:string; }
export interface Invoice { id:string; invoiceNumber:string; practiceId:string; practiceName:string; shipmentIds:string[]; caseIds:string[]; status:InvoiceStatus; terms:PaymentTerms; issuedAt:string; dueAt:string; subtotal:number; discountTotal:number; adjustmentTotal:number; taxableAmount:number; taxRate:number; taxAmount:number; total:number; amountPaid:number; balance:number; lines:InvoiceLine[]; adjustments:InvoiceAdjustment[]; payments:Payment[]; notes:string; createdAt:string; updatedAt:string; }
export interface InvoiceUpdateInput { terms:PaymentTerms; taxRate:number; notes:string; }
export interface AdjustmentInput { type:'discount'|'fee'|'credit'; description:string; amount:number; actorName:string; }
export interface PaymentInput { amount:number; method:PaymentMethod; reference:string; receivedAt:string; recordedBy:string; }
export interface AgingBucket { current:number; days1To30:number; days31To60:number; days61To90:number; over90:number; total:number; }
export interface MonthlyStatement { id:string; statementNumber:string; practiceId:string; practiceName:string; period:string; generatedAt:string; invoiceIds:string[]; openingBalance:number; charges:number; payments:number; closingBalance:number; aging:AgingBucket; }
export interface FinancialMetrics { invoicedTotal:number; collectedTotal:number; outstandingAR:number; overdueAR:number; invoiceCount:number; paidInvoiceCount:number; averageDaysToPay:number; aging:AgingBucket; }
export interface FinancialRepository { listInvoices():Promise<Invoice[]>; getInvoice(id:string):Promise<Invoice|null>; saveInvoice(invoice:Invoice):Promise<void>; listStatements():Promise<MonthlyStatement[]>; saveStatement(statement:MonthlyStatement):Promise<void>; }
export interface LaboratoryCase { id:string; caseNumber:string; practiceId:string; doctorId:string; patientReference:string; restorationType:string; toothNumbers:string; intakeType:IntakeType; route:WorkflowRoute; department:string; status:CaseStatus; receivedDate:string; dueDate:string; notes:string; createdAt:string; }
export interface AuditEvent { id:string; actor:string; action:string; entityType:string; entityId:string; createdAt:string; }
export interface DashboardSnapshot { generatedAt:string; casesReceivedToday:number; casesDueToday:number; casesAtRisk:number; casesInQc:number; shipmentsReady:number; monthRevenue:number; activeDoctors:number; activePractices:number; activePatients:number; openCases:number; rushCases:number; productionOverdue:number; productionInProgress:number; departmentWorkload:DepartmentWorkload[]; }
export interface QualityDashboardSnapshot extends DashboardSnapshot { qcPassRate:number; qcRemakeRate:number; qcReworkRate:number; qcFirstPassYield:number; qcDefectTrends:Array<{category:QCDefectCategory;count:number}>; }
export interface LogisticsDashboardSnapshot extends QualityDashboardSnapshot { logistics:LogisticsMetrics; }
export interface FinancialDashboardSnapshot extends LogisticsDashboardSnapshot { financial:FinancialMetrics; }
