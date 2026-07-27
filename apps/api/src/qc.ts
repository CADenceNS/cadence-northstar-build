import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { ClinicalCase, QCDefectCategory, QCInspection, QCInspectionInput, QCMetrics, QCOutcome, QCPhoto, QCPhotoInput, QCTemplate, QCTemplateInput } from '@northstar/shared';

const outcomes: QCOutcome[] = ['pass','rework','hold','remake','doctor-clarification'];
const categories: QCDefectCategory[] = ['fit','contacts','occlusion','margin','anatomy','shade','surface','material','implant-interface','prescription','other'];

export function createQcEngine(app: Express, cases: ClinicalCase[], now: () => string) {
  const templates: QCTemplate[] = [{
    id:'template-fixed',name:'Fixed Restoration Final QC',restorationTypes:['Full Zirconia Crown','Layered Zirconia','E.max Crown','Implant Crown'],status:'active',
    checklistItems:[
      {id:'check-fit',label:'Internal fit and seating verified',required:true,defectCategory:'fit',sortOrder:1},
      {id:'check-margin',label:'Margins are closed and continuous',required:true,defectCategory:'margin',sortOrder:2},
      {id:'check-contact',label:'Proximal contacts verified',required:true,defectCategory:'contacts',sortOrder:3},
      {id:'check-occlusion',label:'Occlusion verified',required:true,defectCategory:'occlusion',sortOrder:4},
      {id:'check-anatomy',label:'Anatomy and contour verified',required:true,defectCategory:'anatomy',sortOrder:5},
      {id:'check-shade',label:'Shade and surface finish verified',required:true,defectCategory:'shade',sortOrder:6}
    ],createdAt:now(),updatedAt:now()
  }];
  const inspections: QCInspection[] = [];

  function metrics(): QCMetrics {
    const total=inspections.length;
    const count=(outcome:QCOutcome)=>inspections.filter(item=>item.outcome===outcome).length;
    const outcomeCounts=Object.fromEntries(outcomes.map(outcome=>[outcome,count(outcome)])) as Record<QCOutcome,number>;
    const percentage=(value:number)=>total?Number(((value/total)*100).toFixed(1)):0;
    const firstPass=inspections.filter((item,index,array)=>item.outcome==='pass'&&array.findIndex(other=>other.caseId===item.caseId)===index).length;
    return {totalInspections:total,passRate:percentage(outcomeCounts.pass),remakeRate:percentage(outcomeCounts.remake),reworkRate:percentage(outcomeCounts.rework),firstPassYield:percentage(firstPass),outcomeCounts,defectTrends:categories.map(category=>({category,count:inspections.flatMap(item=>item.defects).filter(defect=>defect.category===category).length})).filter(item=>item.count>0).sort((a,b)=>b.count-a.count)};
  }

  app.get('/api/qc/templates',(req,res)=>{const restoration=typeof req.query.restoration==='string'?req.query.restoration:'';res.json(templates.filter(item=>item.status==='active'&&(!restoration||item.restorationTypes.includes(restoration))))});
  app.post('/api/qc/templates',(req,res)=>{const body=req.body as QCTemplateInput;if(!body.name?.trim()||!body.restorationTypes?.length||!body.checklistItems?.length)return res.status(400).json({error:'Template name, restoration types, and checklist items are required.'});if(body.checklistItems.some(item=>!item.label?.trim()||!categories.includes(item.defectCategory)))return res.status(400).json({error:'Every checklist item requires a label and valid defect category.'});const item:QCTemplate={id:randomUUID(),name:body.name.trim(),restorationTypes:body.restorationTypes,status:body.status,checklistItems:body.checklistItems.map(value=>({...value,id:randomUUID()})),createdAt:now(),updatedAt:now()};templates.push(item);return res.status(201).json(item)});
  app.put('/api/qc/templates/:id',(req,res)=>{const index=templates.findIndex(item=>item.id===req.params.id);if(index<0)return res.status(404).json({error:'QC template not found.'});const body=req.body as QCTemplateInput;if(!body.name?.trim()||!body.restorationTypes?.length||!body.checklistItems?.length)return res.status(400).json({error:'Template name, restoration types, and checklist items are required.'});templates[index]={...templates[index],...body,name:body.name.trim(),checklistItems:body.checklistItems.map(value=>({...value,id:randomUUID()})),updatedAt:now()};return res.json(templates[index])});
  app.get('/api/qc/inspections',(req,res)=>{const caseId=typeof req.query.caseId==='string'?req.query.caseId:'';const outcome=typeof req.query.outcome==='string'?req.query.outcome:'';res.json(inspections.filter(item=>(!caseId||item.caseId===caseId)&&(!outcome||item.outcome===outcome)))});
  app.get('/api/qc/inspections/:id',(req,res)=>{const item=inspections.find(value=>value.id===req.params.id);return item?res.json(item):res.status(404).json({error:'QC inspection not found.'})});
  app.post('/api/qc/inspections',(req,res)=>{const body=req.body as QCInspectionInput;const clinicalCase=cases.find(item=>item.id===body.caseId);const template=templates.find(item=>item.id===body.templateId&&item.status==='active');if(!clinicalCase)return res.status(400).json({error:'A valid clinical case is required.'});if(!template||!template.restorationTypes.includes(clinicalCase.restoration))return res.status(400).json({error:'A compatible active QC template is required.'});if(!outcomes.includes(body.outcome)||!body.inspectorId?.trim()||!body.inspectorName?.trim())return res.status(400).json({error:'Outcome and digital inspector sign-off are required.'});const required=template.checklistItems.filter(item=>item.required);if(required.some(item=>!body.checklist.some(result=>result.checklistItemId===item.id&&result.result!=='not-applicable')))return res.status(400).json({error:'All required checklist items must be inspected.'});if(body.checklist.some(result=>result.result==='fail')&&body.defects.length===0)return res.status(400).json({error:'Failed checklist items require at least one categorized defect.'});if(body.outcome==='pass'&&body.checklist.some(result=>result.result==='fail'))return res.status(400).json({error:'A passing inspection cannot contain failed checklist items.'});const id=randomUUID(),timestamp=now();const inspection:QCInspection={id,caseId:clinicalCase.id,caseNumber:clinicalCase.caseNumber,templateId:template.id,restorationType:clinicalCase.restoration,outcome:body.outcome,checklist:body.checklist,defects:body.defects.map(defect=>({...defect,id:randomUUID()})),photos:[],inspectorId:body.inspectorId.trim(),inspectorName:body.inspectorName.trim(),signedAt:timestamp,notes:body.notes?.trim()??'',history:[{id:randomUUID(),inspectionId:id,action:'digitally-signed',outcome:body.outcome,note:body.notes?.trim()??'',actorId:body.inspectorId.trim(),actorName:body.inspectorName.trim(),occurredAt:timestamp}],createdAt:timestamp,updatedAt:timestamp};inspections.push(inspection);clinicalCase.status=body.outcome==='pass'?'ready-to-ship':'qc';clinicalCase.updatedAt=timestamp;return res.status(201).json(inspection)});
  app.post('/api/qc/inspections/:id/photos',(req,res)=>{const inspection=inspections.find(item=>item.id===req.params.id);if(!inspection)return res.status(404).json({error:'QC inspection not found.'});const body=req.body as QCPhotoInput;if(!body.fileName?.trim()||!body.mimeType?.startsWith('image/')||!body.contentBase64?.trim())return res.status(400).json({error:'A valid QC photo is required.'});const photo:QCPhoto={...body,id:randomUUID(),inspectionId:inspection.id,fileName:body.fileName.trim(),uploadedBy:body.uploadedBy?.trim()||inspection.inspectorName,uploadedAt:now()};inspection.photos.push(photo);inspection.history.unshift({id:randomUUID(),inspectionId:inspection.id,action:'photo-attached',outcome:inspection.outcome,note:photo.fileName,actorId:inspection.inspectorId,actorName:photo.uploadedBy,occurredAt:photo.uploadedAt});inspection.updatedAt=photo.uploadedAt;return res.status(201).json(photo)});
  app.get('/api/qc/metrics',(_req,res)=>res.json(metrics()));
  return {metrics};
}
