'use client';

import { useState } from 'react';
import {
  DEFAULT_PAPER_FILE_STATUS, NEW_PATIENT_PAPER_FILE_STATUSES, normaliseCellphone, patientFormErrors, sastIsoDate,
  type NewPatientInput, type PatientField, type PatientFormErrors, type PatientInput,
} from '@pholo/types';
import { ApiError } from './api';
import { Button } from './Button';
import { dateOfBirthIso } from './checkinRules';
import { DateOfBirthField } from './DateOfBirthField';
import { Dropdown } from './Dropdown';
import { FieldError } from './FieldError';
import { focusRing } from './classes';
import { MESSAGES } from './messages';
import { ModalFrame } from './ModalFrame';
import type { PatientRecord } from './patientsApi';
import { TextField } from './TextField';
import { useOnlineStatus } from './useOnlineStatus';

interface PatientDetailsModalProps {
  mode: 'create' | 'edit';
  /** The stored details (edit only). */
  patient?: PatientRecord;
  /** Saves the details. A refusal comes back as an ApiError; success lets the parent close the modal. */
  onSubmit: (body: NewPatientInput | PatientInput) => Promise<void>;
  onCancel: () => void;
  /** "Open their file": S8 of the Patient who already has the ID number. */
  onOpenExisting: (patientId: string) => void;
  /** Forces the Offline state. Left out, the browser's online status decides. */
  offline?: boolean;
}

const FIELDS: readonly PatientField[] = ['first_name', 'surname', 'date_of_birth', 'id_number', 'cellphone', 'paper_file_status'];

/** M2 Patient details: "New patient" (Reception) or "Edit patient details" (Reception and Clinical). */
export function PatientDetailsModal({ mode, patient, onSubmit, onCancel, onOpenExisting, offline }: PatientDetailsModalProps) {
  const online = useOnlineStatus();
  const isOffline = offline ?? !online;
  const creating = mode === 'create';

  const [firstName, setFirstName] = useState(patient?.firstName ?? '');
  const [surname, setSurname] = useState(patient?.surname ?? '');
  const [day, setDay] = useState(patient ? String(Number(patient.dateOfBirth.slice(8, 10))).padStart(2, '0') : '');
  const [month, setMonth] = useState(patient ? patient.dateOfBirth.slice(5, 7) : '');
  const [year, setYear] = useState(patient ? patient.dateOfBirth.slice(0, 4) : '');
  const [idNumber, setIdNumber] = useState(patient?.idNumber ?? '');
  const [cellphone, setCellphone] = useState(patient?.cellphone ?? '');
  const [status, setStatus] = useState<string>(DEFAULT_PAPER_FILE_STATUS);

  const [errors, setErrors] = useState<PatientFormErrors>({});
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const dateOfBirth = dateOfBirthIso({ day, month, year }) ?? '';
    const found = patientFormErrors(
      { first_name: firstName, surname, date_of_birth: dateOfBirth, id_number: idNumber, cellphone, paper_file_status: status },
      sastIsoDate(new Date()),
      creating,
    );
    setErrors(found);
    setDuplicateOf(null);
    setServerError(undefined);
    if (FIELDS.some((field) => found[field])) return;

    const details: PatientInput = {
      first_name: firstName.trim(),
      surname: surname.trim(),
      date_of_birth: dateOfBirth,
      id_number: idNumber.trim() === '' ? null : idNumber.trim(),
      cellphone: cellphone.trim() === '' ? null : normaliseCellphone(cellphone),
    };
    setSaving(true);
    try {
      await onSubmit(creating ? { ...details, paper_file_status: status as NewPatientInput['paper_file_status'] } : details);
    } catch (caught) {
      setSaving(false);
      if (!(caught instanceof ApiError)) {
        setServerError(MESSAGES.serverProblem);
      } else if (caught.status === 409 && typeof caught.data.existing_patient_id === 'string') {
        setErrors({ id_number: caught.message });
        setDuplicateOf(caught.data.existing_patient_id);
      } else if (caught.status === 400 && FIELDS.includes(caught.data.field as PatientField)) {
        setErrors({ [caught.data.field as PatientField]: caught.message });
      } else if (caught.status !== 0) {
        setServerError(caught.message); // offline (status 0) is shown by the banner instead
      }
    }
  };

  return (
    <ModalFrame
      title={creating ? 'New patient' : 'Edit patient details'}
      offline={isOffline}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isOffline} loading={saving} loadingLabel="Saving...">
            Save
          </Button>
        </>
      }
    >
      <TextField label="First name" value={firstName} onChange={setFirstName} placeholder="For example Nomvula" error={errors.first_name} maxLength={40} autoComplete="off" />
      <TextField label="Surname" value={surname} onChange={setSurname} placeholder="For example Pillay" error={errors.surname} maxLength={40} autoComplete="off" />
      <DateOfBirthField
        day={day}
        month={month}
        year={year}
        size="staff"
        error={errors.date_of_birth}
        onChange={(patch) => {
          if (patch.day !== undefined) setDay(patch.day);
          if (patch.month !== undefined) setMonth(patch.month);
          if (patch.year !== undefined) setYear(patch.year);
        }}
      />
      <TextField
        label="ID number"
        value={idNumber}
        onChange={(value) => {
          setIdNumber(value);
          setDuplicateOf(null);
        }}
        placeholder="13 digits, if the patient has one"
        error={errors.id_number}
        inputMode="numeric"
        maxLength={13}
        autoComplete="off"
      />
      {duplicateOf ? (
        <button type="button" onClick={() => onOpenExisting(duplicateOf)} className={`self-start min-h-touch text-staff-body font-bold text-primary underline ${focusRing}`}>
          Open their file
        </button>
      ) : null}
      <TextField label="Cellphone number" value={cellphone} onChange={setCellphone} type="tel" placeholder="For example 083 555 0198" error={errors.cellphone} autoComplete="off" />
      {creating ? (
        <Dropdown
          label="Paper file status"
          options={NEW_PATIENT_PAPER_FILE_STATUSES}
          value={status}
          onChange={setStatus}
          placeholder="Choose a status"
          error={errors.paper_file_status}
        />
      ) : (
        <div className="flex flex-col gap-s1">
          <span className="text-staff-body font-bold text-text">Paper file status</span>
          <span className="text-staff-body text-text">{patient?.paperFileStatus}</span>
        </div>
      )}
      {serverError ? <FieldError message={serverError} /> : null}
    </ModalFrame>
  );
}
