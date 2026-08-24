import type { Patient } from '@northstar/shared';

/** Normalizes only the safe name representations accepted for display de-duplication. */
function normalized(value:string):string {
 return value.trim().toLocaleLowerCase().replace(/[,.]/g,' ').replace(/\s+/g,' ').trim();
}

/** The name is the human identity; the optional reference remains separate. */
export function patientIdentity(patient:Pick<Patient,'firstName'|'lastName'|'patientReference'>):string {
 const first=patient.firstName.trim(),last=patient.lastName.trim(),reference=patient.patientReference.trim();
 const name=[last,first].filter(Boolean).join(', ');
 const duplicate=Boolean(first&&last&&reference&&[`${first} ${last}`,`${last} ${first}`].map(normalized).includes(normalized(reference)));
 return reference&&!duplicate&&name?`${reference} — ${name}`:name||reference||'Unnamed patient';
}

export function patientName(patient:Pick<Patient,'firstName'|'lastName'>):string {
 return [patient.lastName.trim(),patient.firstName.trim()].filter(Boolean).join(', ')||'Unnamed patient';
}
