import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  VISIT_FIELD_ORDER, VISIT_MESSAGES, draftErrors, visitFormErrors,
  type VisitDetailResponse, type VisitFormErrors, type VisitFormValues,
} from '@pholo/types';
import { MESSAGES, type AuthUser } from '../auth/auth.types';
import { SupabaseService } from '../auth/supabase.service';

const VISIT_COLUMNS =
  'id, patient_id, queue_number, checkin_at, reason_category, urgent, status, symptoms, notes, icd10_codes, outcome';
const PATIENT_COLUMNS =
  'id, file_number, first_name, surname, date_of_birth, paper_file_status, chronic_conditions, allergies, current_medication';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DbError = { code?: string; message: string };
type AuditAction = 'started_consultation' | 'saved_draft' | 'completed_visit';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const orNull = (value: string): string | null => (value.trim() === '' ? null : value);

@Injectable()
export class VisitsService {
  constructor(private readonly supabase: SupabaseService) {}

  /** OP14 (SEC10): the Visit with its saved draft, and the Patient with the paper file history. Any status is answered; S9 decides where to go. */
  async get(user: AuthUser, id: string): Promise<VisitDetailResponse> {
    if (!UUID.test(id)) throw this.notFound();
    const db = this.supabase.forToken(user.token);
    const visit = await db.from('visits').select(VISIT_COLUMNS).eq('id', id).maybeSingle();
    if (visit.error) throw this.serverProblem();
    if (!visit.data) throw this.notFound();
    const row = visit.data as unknown as VisitDetailResponse['visit'];
    const patient = await db.from('patients').select(PATIENT_COLUMNS).eq('id', row.patient_id).maybeSingle();
    if (patient.error) throw this.serverProblem();
    if (!patient.data) throw this.notFound();
    return { visit: row, patient: patient.data as unknown as VisitDetailResponse['patient'] };
  }

  /** OP7 (BR7, BR16): a Called Visit becomes In consultation (the trigger visits_guard sets started_at and the clinician). */
  async start(user: AuthUser, id: string): Promise<{ status: 'In consultation' }> {
    const updated = await this.update(user, id, { status: 'In consultation' }, 'Called');
    if (updated) {
      await this.audit(user, 'started_consultation', id);
      return { status: 'In consultation' };
    }
    // Not Called: opening a Visit that is already In consultation is fine ("Continue"); anything else is refused.
    const status = await this.statusOf(user, id);
    if (status === 'In consultation') return { status: 'In consultation' };
    throw new HttpException({ message: VISIT_MESSAGES.cannotStart }, 409);
  }

  /** OP15 (BR8, BR16): no field is required; only the limits apply. Empty texts are stored as nothing. */
  async saveDraft(user: AuthUser, id: string, body: unknown): Promise<{ saved: true }> {
    const values = this.valuesOf(body);
    this.refuse(draftErrors(values));
    const saved = await this.update(user, id, this.columns(values), 'In consultation');
    if (!saved) throw await this.notEditable(user, id);
    await this.audit(user, 'saved_draft', id);
    return { saved: true };
  }

  /** OP16 (BR8, BR9, BR16): symptoms and an outcome are required; the trigger visits_guard sets completed_at and locks the Visit. */
  async complete(user: AuthUser, id: string, body: unknown): Promise<{ status: 'Completed' }> {
    const values = this.valuesOf(body);
    this.refuse(visitFormErrors(values));
    const saved = await this.update(user, id, { ...this.columns(values), status: 'Completed' }, 'In consultation');
    if (!saved) throw await this.notEditable(user, id);
    await this.audit(user, 'completed_visit', id);
    return { status: 'Completed' };
  }

  /** The update runs with the user's token, only while the Visit has the expected status. Returns whether a row changed. */
  private async update(user: AuthUser, id: string, changes: Record<string, unknown>, expected: string): Promise<boolean> {
    if (!UUID.test(id)) throw this.notFound();
    const { data, error } = await this.supabase
      .forToken(user.token)
      .from('visits')
      .update(changes)
      .eq('id', id)
      .eq('status', expected)
      .select('id');
    if (error) throw this.mapError(error);
    return ((data ?? []) as unknown[]).length > 0;
  }

  /** The Visit's current status, or a 404 when there is no such Visit. */
  private async statusOf(user: AuthUser, id: string): Promise<string> {
    const { data, error } = await this.supabase.forToken(user.token).from('visits').select('status').eq('id', id).maybeSingle();
    if (error) throw this.serverProblem();
    if (!data) throw this.notFound();
    return (data as { status: string }).status;
  }

  /** BR9: a Completed or Left Visit (or one not In consultation) cannot be saved or completed. */
  private async notEditable(user: AuthUser, id: string): Promise<HttpException> {
    try {
      await this.statusOf(user, id);
    } catch (error) {
      return error as HttpException;
    }
    return new HttpException({ message: VISIT_MESSAGES.notEditable }, 409);
  }

  private valuesOf(body: unknown): VisitFormValues {
    const raw = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    return {
      symptoms: text(raw.symptoms).trim(),
      notes: text(raw.notes),
      icd10_codes: text(raw.icd10_codes).trim(),
      outcome: text(raw.outcome),
    };
  }

  private columns(values: VisitFormValues) {
    return {
      symptoms: orNull(values.symptoms),
      notes: orNull(values.notes),
      icd10_codes: orNull(values.icd10_codes),
      outcome: orNull(values.outcome),
    };
  }

  /** The first fault in screen order comes back with its field and exact message. */
  private refuse(errors: VisitFormErrors): void {
    const field = VISIT_FIELD_ORDER.find((name) => errors[name]);
    if (field) throw new HttpException({ message: errors[field], field }, 400);
  }

  /** BR16: every one of these actions writes one AuditLog row (only the service role can write the AuditLog). */
  private async audit(user: AuthUser, action: AuditAction, visitId: string): Promise<void> {
    const { error } = await this.supabase.admin().rpc('write_audit', {
      p_facility_id: user.facilityId,
      p_actor_id: user.id,
      p_action: action,
      p_entity_type: 'Visit',
      p_entity_id: visitId,
    });
    if (error) throw this.serverProblem();
  }

  private mapError(error: DbError): HttpException {
    if (error.code === '42501') return new HttpException({ message: MESSAGES.notAllowed }, 403);
    if (error.code === '23514') return new HttpException({ message: VISIT_MESSAGES.notEditable }, 409);
    return this.serverProblem();
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ message: VISIT_MESSAGES.visitNotFound });
  }

  private serverProblem(): HttpException {
    return new HttpException({ message: MESSAGES.serverProblem }, 500);
  }
}
