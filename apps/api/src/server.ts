import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import type { CommunicationEntry, DashboardSnapshot, Doctor, DoctorInput, EntityStatus, Practice, PracticeInput } from '@northstar/shared';

const app = express();
const port = Number(process.env.PORT ?? 4000);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const now = () => new Date().toISOString();
let accountSequence = 1001;
const practices: Practice[] = [{
  id: 'practice-1', accountNumber: 'KDL-1001', practiceName: 'NorthStar Dental Group', status: 'active',
  phone: '818-555-0148', email: 'office@northstardental.example', address: '19350 Business Ctr Dr', city: 'Northridge', state: 'CA', postalCode: '91324',
  taxExempt: false, scannerType: 'iTero', officeManager: { name: 'Alex Morgan', email: 'manager@northstardental.example', phone: '818-555-0199' },
  notes: 'Primary digital client.', communicationHistory: [], createdAt: now(), updatedAt: now()
}];
const doctors: Doctor[] = [{
  id: 'doctor-1', practiceId: 'practice-1', firstName: 'Beibei', lastName: 'Wu', specialty: 'General Dentistry',
  email: 'doctor@example.com', phone: '818-555-0171', status: 'active', active: true, notes: '', communicationHistory: [], createdAt: now(), updatedAt: now()
}];

function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function status(value: unknown): EntityStatus { return value === 'inactive' ? 'inactive' : 'active'; }
function validatePractice(body: Partial<PracticeInput>) {
  const errors: string[] = [];
  if (!text(body.practiceName)) errors.push('Practice name is required.');
  if (!text(body.phone)) errors.push('Practice phone is required.');
  if (!validEmail(text(body.email))) errors.push('A valid practice email is required.');
  if (!text(body.officeManager?.name)) errors.push('Office manager name is required.');
  if (!validEmail(text(body.officeManager?.email))) errors.push('A valid office manager email is required.');
  return errors;
}
function validateDoctor(body: Partial<DoctorInput>) {
  const errors: string[] = [];
  if (!practices.some(item => item.id === body.practiceId)) errors.push('A valid practice is required.');
  if (!text(body.firstName)) errors.push('First name is required.');
  if (!text(body.lastName)) errors.push('Last name is required.');
  if (!validEmail(text(body.email))) errors.push('A valid doctor email is required.');
  return errors;
}
function queryMatch(values: string[], query: string) { return values.join(' ').toLowerCase().includes(query.toLowerCase()); }
function addCommunication(entityType: 'practice' | 'doctor', entityId: string, body: Partial<CommunicationEntry>) {
  const summary = text(body.summary);
  if (!summary) return null;
  return { id: randomUUID(), entityType, entityId, type: body.type ?? 'note', summary, occurredAt: body.occurredAt ?? now(), createdBy: text(body.createdBy) || 'Dorian Habet' } satisfies CommunicationEntry;
}

app.get('/health', (_request, response) => response.json({ service: 'cadence-northstar-api', status: 'ok', version: '0.3.0' }));
app.post('/api/auth/login', (request, response) => {
  const { email, password } = request.body as { email?: string; password?: string };
  if (email === 'dorianhabet@yahoo.com' && password === 'NorthStar!2026') return response.json({ user: { id: 'usr-admin', name: 'Dorian Habet', email, role: 'administrator', active: true } });
  return response.status(401).json({ error: 'Invalid credentials' });
});
app.get('/api/dashboard', (_request, response) => {
  const snapshot: DashboardSnapshot = { generatedAt: now(), casesReceivedToday: 1, casesDueToday: 0, casesAtRisk: 0, casesInQc: 0, shipmentsReady: 0, monthRevenue: 0, activeDoctors: doctors.filter(item => item.status === 'active').length, activePractices: practices.filter(item => item.status === 'active').length };
  response.json(snapshot);
});

app.get('/api/practices', (request, response) => {
  const search = text(request.query.search); const filter = text(request.query.status);
  response.json(practices.filter(item => (!filter || filter === 'all' || item.status === filter) && (!search || queryMatch([item.accountNumber, item.practiceName, item.email, item.officeManager.name], search))));
});
app.post('/api/practices', (request, response) => {
  const body = request.body as PracticeInput; const errors = validatePractice(body); if (errors.length) return response.status(400).json({ errors });
  accountSequence += 1;
  const item: Practice = { ...body, id: randomUUID(), accountNumber: `KDL-${accountSequence}`, status: status(body.status), officeManager: { name: text(body.officeManager.name), email: text(body.officeManager.email), phone: text(body.officeManager.phone) }, notes: text(body.notes), communicationHistory: [], createdAt: now(), updatedAt: now() };
  practices.push(item); return response.status(201).json(item);
});
app.put('/api/practices/:id', (request, response) => {
  const index = practices.findIndex(item => item.id === request.params.id); if (index < 0) return response.status(404).json({ error: 'Practice not found.' });
  const body = request.body as PracticeInput; const errors = validatePractice(body); if (errors.length) return response.status(400).json({ errors });
  practices[index] = { ...practices[index], ...body, id: practices[index].id, accountNumber: practices[index].accountNumber, status: status(body.status), officeManager: { name: text(body.officeManager.name), email: text(body.officeManager.email), phone: text(body.officeManager.phone) }, notes: text(body.notes), communicationHistory: practices[index].communicationHistory, updatedAt: now() };
  return response.json(practices[index]);
});
app.delete('/api/practices/:id', (request, response) => {
  const index = practices.findIndex(item => item.id === request.params.id); if (index < 0) return response.status(404).json({ error: 'Practice not found.' });
  if (doctors.some(item => item.practiceId === request.params.id)) return response.status(409).json({ error: 'Practice has linked doctors and cannot be deleted.' });
  practices.splice(index, 1); return response.status(204).send();
});
app.post('/api/practices/:id/communications', (request, response) => {
  const item = practices.find(value => value.id === request.params.id); if (!item) return response.status(404).json({ error: 'Practice not found.' });
  const entry = addCommunication('practice', item.id, request.body); if (!entry) return response.status(400).json({ error: 'Communication summary is required.' });
  item.communicationHistory.unshift(entry); item.updatedAt = now(); return response.status(201).json(entry);
});

app.get('/api/doctors', (request, response) => {
  const search = text(request.query.search); const filter = text(request.query.status); const practiceId = text(request.query.practiceId);
  response.json(doctors.filter(item => (!filter || filter === 'all' || item.status === filter) && (!practiceId || item.practiceId === practiceId) && (!search || queryMatch([item.firstName, item.lastName, item.email, item.specialty], search))));
});
app.post('/api/doctors', (request, response) => {
  const body = request.body as DoctorInput; const errors = validateDoctor(body); if (errors.length) return response.status(400).json({ errors });
  const doctorStatus = status(body.status);
  const item: Doctor = { ...body, id: randomUUID(), status: doctorStatus, active: doctorStatus === 'active', notes: text(body.notes), communicationHistory: [], createdAt: now(), updatedAt: now() };
  doctors.push(item); return response.status(201).json(item);
});
app.put('/api/doctors/:id', (request, response) => {
  const index = doctors.findIndex(item => item.id === request.params.id); if (index < 0) return response.status(404).json({ error: 'Doctor not found.' });
  const body = request.body as DoctorInput; const errors = validateDoctor(body); if (errors.length) return response.status(400).json({ errors });
  const doctorStatus = status(body.status);
  doctors[index] = { ...doctors[index], ...body, id: doctors[index].id, status: doctorStatus, active: doctorStatus === 'active', notes: text(body.notes), communicationHistory: doctors[index].communicationHistory, updatedAt: now() };
  return response.json(doctors[index]);
});
app.delete('/api/doctors/:id', (request, response) => {
  const index = doctors.findIndex(item => item.id === request.params.id); if (index < 0) return response.status(404).json({ error: 'Doctor not found.' });
  doctors.splice(index, 1); return response.status(204).send();
});
app.post('/api/doctors/:id/communications', (request, response) => {
  const item = doctors.find(value => value.id === request.params.id); if (!item) return response.status(404).json({ error: 'Doctor not found.' });
  const entry = addCommunication('doctor', item.id, request.body); if (!entry) return response.status(400).json({ error: 'Communication summary is required.' });
  item.communicationHistory.unshift(entry); item.updatedAt = now(); return response.status(201).json(entry);
});

app.listen(port, () => console.log(`CADence NorthStar API listening on http://localhost:${port}`));
