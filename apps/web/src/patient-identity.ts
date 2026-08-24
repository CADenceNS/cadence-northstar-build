import type { Patient } from '@northstar/shared';

/** The name is the human identity; the optional reference remains separate. */
export function patientIdentity(patient:Pick<Patient,'firstName'|'lastName'|'patientReference'>):string {
 const name=[patient.lastName.trim(),patient.firstName.trim()].filter(Boolean).join(', ');
 return patient.patientReference.trim()&&name?`${patient.patientReference.trim()} — ${name}`:name||patient.patientReference.trim()||'Unnamed patient';
}

export function patientName(patient:Pick<Patient,'firstName'|'lastName'>):string {
 return [patient.lastName.trim(),patient.firstName.trim()].filter(Boolean).join(', ')||'Unnamed patient';
}
