import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PAPER_HISTORY_FIELD_ORDER, PAPER_HISTORY_MESSAGES, PATIENT_FIELD_ORDER, PATIENT_MESSAGES, SEARCH_MAX_RESULTS, SEARCH_MIN_LENGTH, normaliseCellphone,
  paperHistoryErrors, patientFormErrors, sastIsoDate,
  type PatientFileResponse, type PatientFileVisitDetails, type PatientFormValues, type PatientRecord, type PatientSearchItem,
} from '@pholo/types';
import { MESSAGES, type AuthUser } from '../auth/auth.types';
import { SupabaseService } from '../auth/supabase.service';

const PATIENT_COLUMNS =
  'id, file_number, first_name, surname, date_of_birth, id_number, cellphone, paper_file_status, chronic_conditions, allergies, current_medication';
const VISIT_COLUMNS = 'id, queue_number, checkin_at, reason_category, status, urgent';
/** Clinical reads the visits table itself (policy visits_select_clinical), so the clinical columns come too (SEC10). */
const CLINICAL_VISIT_COLUMNS = `${VISIT_COLUMNS}, symptoms, notes, icd10_codes, outcome, clinician`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DbError = { code?: string; message: string };
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const lower = (value: string): string => value.toLowerCase();

/** % and _ in the typed text are plain characters, not wildcards. */
const likePrefix = (value: string): string => `${value.replace(/[\\%_]/g, '\\$&')}%`;

const toSearchItem = (row: PatientRecord): PatientSearchItem => ({
  id: row.id,
  file_number: row.file_number,
  first_name: row.first_name,
  surname: row.surname,
  date_of_birth: row.date_of_birth,
  id_number_last4: row.id_number ? row.id_number.slice(-4) : null,
  paper_file_status: row.paper_file_status,
});

@Injectable()
export class PatientsService {
  constructor(private readonly supabase: SupabaseService) {}

  /** OP9 (BR13): a name prefix, an exact 13-digit ID number or an exact file number; at most 20, by surname then first name. */
  async search(user: AuthUser, query: unknown): Promise<{ patients: PatientSearchItem[] }> {
    const q = text(query);
    if (q.length < SEARCH_MIN_LENGTH) throw new BadRequestException({ message: PATIENT_MESSAGES.searchTooShort });

    const db = this.supabase.forToken(user.token);
    const base = () => db.from('patients').select(PATIENT_COLUMNS);
    let answers: Array<{ data: unknown; error: DbError | null }>;
    if (/^[0-9]{13}$/.test(q)) {
      answers = [await base().eq('id_number', q).limit(SEARCH_MAX_RESULTS)];
    } else if (/^PH-[0-9]{6}$/i.test(q)) {
      answers = [await base().eq('file_number', q.toUpperCase()).limit(SEARCH_MAX_RESULTS)];
    } else {
      const pattern = likePrefix(q);
      answers = await Promise.all(
        (['surname', 'first_name'] as const).map((column) =>
          base().ilike(column, pattern).order('surname').order('first_name').limit(SEARCH_MAX_RESULTS),
        ),
      );
    }
    if (answers.some((answer) => answer.error)) {
      throw new HttpException({ message: PATIENT_MESSAGES.searchFailed }, 500);
    }

    const seen = new Set<string>();
    const rows = answers.flatMap((answer) => (answer.data ?? []) as PatientRecord[]).filter((row) => !seen.has(row.id) && !!seen.add(row.id));
    rows.sort((a, b) => lower(a.surname).localeCompare(lower(b.surname)) || lower(a.first_name).localeCompare(lower(b.first_name)));
    return { patients: rows.slice(0, SEARCH_MAX_RESULTS).map(toSearchItem) };
  }

  /**
   * OP10 (BR16, SEC10, SEC11): the Patient and the Visits, newest first. Reception reads the view visits_for_reception, which has no
   * symptoms, notes, ICD-10 codes or outcome. Clinical reads the visits table and also gets those four and the clinician's name.
   */
  async getFile(user: AuthUser, id: string): Promise<PatientFileResponse> {
    if (!UUID.test(id)) throw this.notFound();
    const db = this.supabase.forToken(user.token);
    const patient = await db.from('patients').select(PATIENT_COLUMNS).eq('id', id).maybeSingle();
    if (patient.error) throw this.serverProblem();
    if (!patient.data) throw this.notFound();

    let visits: PatientFileResponse['visits'];
    if (user.role === 'Clinical') {
      visits = await this.clinicalVisits(user, id);
    } else {
      const rows = await db.from('visits_for_reception').select(VISIT_COLUMNS).eq('patient_id', id).order('checkin_at', { ascending: false });
      if (rows.error) throw this.serverProblem();
      visits = (rows.data ?? []) as PatientFileResponse['visits'];
    }

    await this.audit(user, 'opened_patient_file', id);
    return { patient: patient.data as PatientRecord, visits };
  }

  private async clinicalVisits(user: AuthUser, patientId: string): Promise<PatientFileVisitDetails[]> {
    const db = this.supabase.forToken(user.token);
    const rows = await db.from('visits').select(CLINICAL_VISIT_COLUMNS).eq('patient_id', patientId).order('checkin_at', { ascending: false });
    if (rows.error) throw this.serverProblem();
    const visits = (rows.data ?? []) as unknown as Array<Omit<PatientFileVisitDetails, 'clinician_name'> & { clinician: string | null }>;

    const names = new Map<string, string>();
    const clinicianIds = [...new Set(visits.flatMap((visit) => (visit.clinician ? [visit.clinician] : [])))];
    if (clinicianIds.length > 0) {
      const staff = await db.from('staff_profiles').select('id, full_name').in('id', clinicianIds);
      if (staff.error) throw this.serverProblem();
      for (const member of (staff.data ?? []) as Array<{ id: string; full_name: string }>) names.set(member.id, member.full_name);
    }
    return visits.map(({ clinician, ...visit }) => ({ ...visit, clinician_name: clinician ? (names.get(clinician) ?? null) : null }));
  }

  /** OP11 (BR4, BR5, BR6, BR16): Reception only (the role guard, and the policy again in the database). */
  async create(user: AuthUser, body: unknown): Promise<PatientRecord> {
    const input = this.checked(body, true);
    const { data, error } = await this.supabase
      .forToken(user.token)
      .from('patients')
      .insert({ facility_id: user.facilityId, ...input, paper_file_status: this.statusOf(body) })
      .select(PATIENT_COLUMNS)
      .single();
    if (error) throw await this.mapWriteError(user, error, input.id_number, undefined);
    const patient = data as PatientRecord;
    await this.audit(user, 'created_patient', patient.id);
    return patient;
  }

  /** OP12 (BR5, BR6, BR16): the file number and the paper file status never change here, whatever is sent. */
  async update(user: AuthUser, id: string, body: unknown): Promise<PatientRecord> {
    if (!UUID.test(id)) throw this.notFound();
    const input = this.checked(body, false);
    const { data, error } = await this.supabase.forToken(user.token).from('patients').update(input).eq('id', id).select(PATIENT_COLUMNS).maybeSingle();
    if (error) throw await this.mapWriteError(user, error, input.id_number, id);
    if (!data) throw this.notFound();
    const patient = data as PatientRecord;
    await this.audit(user, 'updated_patient', patient.id);
    return patient;
  }

  /**
   * OP13 (BR18, BR16): the three history texts replace what is stored (an empty text is null). With the box ticked the status also
   * becomes "Paper file - digitised"; the database trigger patients_guard refuses that unless the status was "not yet digitised" and
   * one text is filled in. The file number and the status are never taken from the request.
   */
  async recordPaperHistory(user: AuthUser, id: string, body: unknown): Promise<PatientRecord> {
    if (!UUID.test(id)) throw this.notFound();
    const raw = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    const values = {
      chronic_conditions: text(raw.chronic_conditions),
      allergies: text(raw.allergies),
      current_medication: text(raw.current_medication),
      mark_digitised: raw.mark_digitised === true,
    };
    const errors = paperHistoryErrors(values);
    const field = PAPER_HISTORY_FIELD_ORDER.find((name) => errors[name]);
    if (field) throw new BadRequestException({ message: errors[field], field });

    const update = {
      chronic_conditions: values.chronic_conditions === '' ? null : values.chronic_conditions,
      allergies: values.allergies === '' ? null : values.allergies,
      current_medication: values.current_medication === '' ? null : values.current_medication,
      ...(values.mark_digitised ? { paper_file_status: 'Paper file - digitised' } : {}),
    };
    const { data, error } = await this.supabase.forToken(user.token).from('patients').update(update).eq('id', id).select(PATIENT_COLUMNS).maybeSingle();
    if (error) {
      if (error.code === '23514') throw new BadRequestException({ message: PAPER_HISTORY_MESSAGES.markWithoutHistory, field: 'mark_digitised' }); // patients_guard
      if (error.code === '42501') throw new HttpException({ message: MESSAGES.notAllowed }, 403);
      throw this.serverProblem();
    }
    if (!data) throw this.notFound();
    const patient = data as PatientRecord;
    await this.audit(user, 'recorded_paper_history', patient.id);
    return patient;
  }

  private statusOf(body: unknown): string {
    return text((body as Record<string, unknown>).paper_file_status);
  }

  /** The five details after the M2 checks; the first fault found comes back with its field and exact message. */
  private checked(body: unknown, creating: boolean) {
    const raw = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    const values: PatientFormValues = {
      first_name: text(raw.first_name),
      surname: text(raw.surname),
      date_of_birth: text(raw.date_of_birth),
      id_number: text(raw.id_number),
      cellphone: text(raw.cellphone),
      paper_file_status: text(raw.paper_file_status),
    };
    const errors = patientFormErrors(values, sastIsoDate(new Date()), creating);
    const field = PATIENT_FIELD_ORDER.find((name) => errors[name]);
    if (field) throw new BadRequestException({ message: errors[field], field });
    return {
      first_name: values.first_name,
      surname: values.surname,
      date_of_birth: values.date_of_birth,
      id_number: values.id_number === '' ? null : values.id_number,
      cellphone: values.cellphone === '' ? null : normaliseCellphone(values.cellphone),
    };
  }

  /** A second Patient with the same ID number answers with the message and the existing file, so M2 can open it. */
  private async mapWriteError(user: AuthUser, error: DbError, idNumber: string | null, ownId: string | undefined): Promise<HttpException> {
    if (error.code === '23505' && idNumber) {
      const query = this.supabase.forToken(user.token).from('patients').select('id').eq('id_number', idNumber);
      const existing = await (ownId ? query.neq('id', ownId) : query).maybeSingle();
      return new HttpException(
        { message: PATIENT_MESSAGES.idNumberExists, field: 'id_number', existing_patient_id: (existing.data as { id?: string } | null)?.id },
        409,
      );
    }
    if (error.code === '42501') return new HttpException({ message: MESSAGES.notAllowed }, 403);
    return this.serverProblem();
  }

  /** BR16: every one of these actions writes one AuditLog row (the AuditLog can only be written by the service role). */
  private async audit(user: AuthUser, action: string, patientId: string): Promise<void> {
    const { error } = await this.supabase.admin().rpc('write_audit', {
      p_facility_id: user.facilityId,
      p_actor_id: user.id,
      p_action: action,
      p_entity_type: 'Patient',
      p_entity_id: patientId,
    });
    if (error) throw this.serverProblem();
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ message: PATIENT_MESSAGES.fileNotOpened });
  }

  private serverProblem(): HttpException {
    return new HttpException({ message: MESSAGES.serverProblem }, 500);
  }
}
