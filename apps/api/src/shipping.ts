import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { ClinicalCase, LogisticsMetrics, Shipment, ShipmentInput, ShipmentStatus, ShipmentTransitionInput } from '@northstar/shared';

const statusOrder:ShipmentStatus[]=['ready-to-ship','awaiting-pickup','shipped','delivered'];

export function createShippingEngine(
 app:Express,
 now:()=>string,
 listCases:()=>Promise<ClinicalCase[]>,
 updateCase:(caseId:string,value:ClinicalCase)=>Promise<void>
){
 const shipments:Shipment[]=[];
 let sequence=1;
 const text=(value:unknown)=>typeof value==='string'?value.trim():'';
 const nextNumber=()=>`SHP-${now().slice(2,10).replaceAll('-','')}-${String(sequence++).padStart(3,'0')}`;
 const metrics=():LogisticsMetrics=>({
  readyToShip:shipments.filter(item=>item.status==='ready-to-ship').length,
  awaitingPickup:shipments.filter(item=>item.status==='awaiting-pickup').length,
  shipped:shipments.filter(item=>item.status==='shipped').length,
  delivered:shipments.filter(item=>item.status==='delivered').length,
  totalShipments:shipments.length,
  deliveredOnTime:shipments.filter(item=>item.status==='delivered').length
 });

 app.get('/api/shipping/ready-cases',async(_req,res)=>{
  const cases=await listCases();
  const assigned=new Set(shipments.filter(item=>item.status!=='delivered').flatMap(item=>item.caseIds));
  return res.json(cases.filter(item=>item.status==='ready-to-ship'&&!assigned.has(item.id)).map(item=>({...item,barcodeValue:`CASE-${item.caseNumber}`})));
 });
 app.get('/api/shipping/shipments',(req,res)=>{
  const status=text(req.query.status);
  return res.json(shipments.filter(item=>!status||status==='all'||item.status===status));
 });
 app.get('/api/shipping/shipments/:id',(req,res)=>{const item=shipments.find(value=>value.id===req.params.id);return item?res.json(item):res.status(404).json({error:'Shipment not found.'})});
 app.get('/api/shipping/metrics',(_req,res)=>res.json(metrics()));
 app.post('/api/shipping/shipments',async(req,res)=>{
  const body=req.body as ShipmentInput;
  const cases=await listCases();
  const selected=cases.filter(item=>body.caseIds?.includes(item.id));
  if(!body.caseIds?.length||selected.length!==body.caseIds.length)return res.status(400).json({error:'Select one or more valid cases.'});
  if(selected.some(item=>item.status!=='ready-to-ship'))return res.status(400).json({error:'Every selected case must be QC approved and ready to ship.'});
  if(shipments.some(item=>item.status!=='delivered'&&item.caseIds.some(caseId=>body.caseIds.includes(caseId))))return res.status(409).json({error:'A selected case already belongs to an active shipment.'});
  if(!body.packingChecklist?.length||body.packingChecklist.some(item=>item.required&&!item.completed))return res.status(400).json({error:'Complete every required packing checklist item.'});
  if(!body.courier)return res.status(400).json({error:'Courier selection is required.'});
  const shipmentNumber=nextNumber();const id=randomUUID();const occurredAt=now();
  const item:Shipment={id,shipmentNumber,barcodeValue:`SHIP-${shipmentNumber}`,caseIds:selected.map(value=>value.id),caseNumbers:selected.map(value=>value.caseNumber),status:'ready-to-ship',courier:body.courier,courierName:text(body.courierName),trackingNumber:text(body.trackingNumber),pickupScheduledAt:null,shippedAt:null,deliveredAt:null,packingChecklist:body.packingChecklist.map(value=>({...value,id:randomUUID()})),notes:text(body.notes),history:[{id:randomUUID(),shipmentId:id,fromStatus:null,toStatus:'ready-to-ship',note:'Shipment created and packed.',actorId:text(body.actorId),actorName:text(body.actorName),occurredAt}],createdBy:text(body.actorName),createdAt:occurredAt,updatedAt:occurredAt};
  shipments.push(item);return res.status(201).json(item);
 });
 app.put('/api/shipping/shipments/:id',(req,res)=>{
  const item=shipments.find(value=>value.id===req.params.id);if(!item)return res.status(404).json({error:'Shipment not found.'});
  if(item.status==='delivered')return res.status(409).json({error:'Delivered shipments cannot be edited.'});
  const body=req.body as Partial<ShipmentInput>;
  if(body.packingChecklist&&body.packingChecklist.some(value=>value.required&&!value.completed))return res.status(400).json({error:'Complete every required packing checklist item.'});
  if(body.courier)item.courier=body.courier;if(body.courierName!==undefined)item.courierName=text(body.courierName);if(body.trackingNumber!==undefined)item.trackingNumber=text(body.trackingNumber);if(body.notes!==undefined)item.notes=text(body.notes);if(body.packingChecklist)item.packingChecklist=body.packingChecklist.map(value=>({...value,id:randomUUID()}));item.updatedAt=now();return res.json(item);
 });
 app.post('/api/shipping/shipments/:id/transitions',async(req,res)=>{
  const item=shipments.find(value=>value.id===req.params.id);if(!item)return res.status(404).json({error:'Shipment not found.'});
  const body=req.body as ShipmentTransitionInput;const currentIndex=statusOrder.indexOf(item.status),targetIndex=statusOrder.indexOf(body.status);
  if(targetIndex!==currentIndex+1)return res.status(400).json({error:'Shipment transitions must follow Ready to Ship, Awaiting Pickup, Shipped, and Delivered in order.'});
  const tracking=text(body.trackingNumber)||item.trackingNumber;
  if((body.status==='shipped'||body.status==='delivered')&&!tracking)return res.status(400).json({error:'Tracking number is required before shipment.'});
  const occurredAt=text(body.occurredAt)||now();const previous=item.status;item.status=body.status;item.trackingNumber=tracking;if(body.status==='awaiting-pickup')item.pickupScheduledAt=occurredAt;if(body.status==='shipped')item.shippedAt=occurredAt;if(body.status==='delivered')item.deliveredAt=occurredAt;item.history.unshift({id:randomUUID(),shipmentId:item.id,fromStatus:previous,toStatus:body.status,note:text(body.note),actorId:text(body.actorId),actorName:text(body.actorName),occurredAt});item.updatedAt=now();
  if(body.status==='delivered'){const cases=await listCases();for(const caseId of item.caseIds){const clinicalCase=cases.find(value=>value.id===caseId);if(clinicalCase)await updateCase(caseId,{...clinicalCase,status:'completed',updatedAt:now()})}}
  return res.json(item);
 });
 app.delete('/api/shipping/shipments/:id',(req,res)=>{const index=shipments.findIndex(value=>value.id===req.params.id);if(index<0)return res.status(404).json({error:'Shipment not found.'});if(shipments[index].status!=='ready-to-ship')return res.status(409).json({error:'Only Ready to Ship records can be deleted.'});shipments.splice(index,1);return res.status(204).send()});
 return {metrics};
}
