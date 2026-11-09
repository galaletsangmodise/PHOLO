import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  QUEUE_MESSAGES, sastIsoDate,
  type CallNextResponse, type QueueResponse, type QueueRow, type QueueTab,
} from '@pholo/types';
import { MESSAGES, type AuthUser } from '../auth/auth.types';
import { SupabaseService } from '../auth/supabase.service';
import { countQueue, orderActive, orderDone } from './queue.logic';

/** The Visit columns Reception may read (the view visits_for_reception has no clinical column, SEC11). */
const VISIT_COLUMNS = 'id, patient_id, queue_number, reason_category, urgent, assisted, status, checkin_at, called_at, completed_at, left_at';
const PATIENT_COLUMNS = 'id, first_name, surname, date_of_birth, paper_file_status';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VisitRow = Omit<QueueRow, 'first_name' | 'surname' | 'date_of_birth' | 'paper_file_status'>;
type PatientRow = Pick<QueueRow, 'first_name' | 'surname' | 'date_of_birth' | 'paper_file_status'> & { id: string };

@Injectable()
export class QueueService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * OP5 (BR2, BR7, SEC11): first closes Visits left open on earlier days, then lists today's Visits.
   * The counts always cover the whole day; `tab` only decides which Visits are listed.
   */
  async list(user: AuthUser, tab: QueueTab): Promise<QueueResponse> {
    const db = this.supabase.forToken(user.token);
    const closed = await db.rpc('close_stale_visits');
    if (closed.error) throw this.loadFailed();

    const startOfToday = `${sastIsoDate(new Date())}T00:00:00+02:00`;
    const visits = await db.from('visits_for_reception').select(VISIT_COLUMNS).gte('checkin_at', startOfToday);
    if (visits.error) throw this.loadFailed();
    const visitRows = (visits.data ?? []) as unknown as VisitRow[];

    const patientRows: PatientRow[] = [];
    if (visitRows.length > 0) {
      const ids = [...new Set(visitRows.map((visit) => visit.patient_id))];
      const patients = await db.from('patients').select(PATIENT_COLUMNS).in('id', ids);
      if (patients.error) throw this.loadFailed();
      patientRows.push(...((patients.data ?? []) as unknown as PatientRow[]));
    }
    const patientById = new Map(patientRows.map((patient) => [patient.id, patient]));

    const rows: QueueRow[] = visitRows.flatMap((visit) => {
      const patient = patientById.get(visit.patient_id);
      if (!patient) return [];
      return [{
        id: visit.id,
        patient_id: visit.patient_id,
        queue_number: visit.queue_number,
        first_name: patient.first_name,
        surname: patient.surname,
        date_of_birth: patient.date_of_birth,
        reason_category: visit.reason_category,
        urgent: visit.urgent,
        assisted: visit.assisted,
        status: visit.status,
        paper_file_status: patient.paper_file_status,
        checkin_at: visit.checkin_at,
        called_at: visit.called_at,
        completed_at: visit.completed_at,
        left_at: visit.left_at,
      }];
    });

    return { visits: tab === 'done' ? orderDone(rows) : orderActive(rows), counts: countQueue(rows) };
  }

  /** OP6 (BR2, BR16, SEC23): the database function picks the first Waiting Visit, urgent first, and writes called_next. */
  async callNext(user: AuthUser): Promise<CallNextResponse> {
    const { data, error } = await this.supabase.forToken(user.token).rpc('call_next_patient');
    if (error) throw this.mapError(error);
    const answer = (data ?? {}) as Partial<CallNextResponse>;
    if (answer.none_waiting !== false) return { none_waiting: true };
    return {
      none_waiting: false,
      visit_id: answer.visit_id,
      queue_number: answer.queue_number,
      patient_id: answer.patient_id,
      first_name: answer.first_name,
      surname: answer.surname,
    };
  }

  /** OP8 (BR7, BR16, SEC15): a Waiting or Called Visit becomes Left; the database function writes marked_left. */
  async markLeft(user: AuthUser, visitId: string): Promise<{ status: 'Left' }> {
    if (!UUID.test(visitId)) throw new NotFoundException({ message: QUEUE_MESSAGES.visitNotFound });
    const { error } = await this.supabase.forToken(user.token).rpc('mark_visit_left', { p_visit_id: visitId });
    if (error) throw this.mapError(error);
    return { status: 'Left' };
  }

  private mapError(error: { code?: string }): HttpException {
    if (error.code === '42501') return new HttpException({ message: MESSAGES.notAllowed }, 403);
    if (error.code === 'P0002') return new HttpException({ message: QUEUE_MESSAGES.visitNotFound }, 404);
    if (error.code === '23514') return new HttpException({ message: QUEUE_MESSAGES.leftRefused }, 409);
    return new HttpException({ message: MESSAGES.serverProblem }, 500);
  }

  private loadFailed(): HttpException {
    return new HttpException({ message: QUEUE_MESSAGES.loadFailed }, 500);
  }
}
