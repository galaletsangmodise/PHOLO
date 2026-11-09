export const STAFF_ROLES = ['Reception', 'Clinical', 'Manager', 'Check-in'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const VISIT_STATUSES = ['Waiting', 'Called', 'In consultation', 'Completed', 'Left'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const REASON_CATEGORIES = [
  'Feeling sick or injured',
  'Collecting medication',
  'Baby or child care',
  'Pregnancy or family planning',
  'Test or screening',
  'Something else',
] as const;
export type ReasonCategory = (typeof REASON_CATEGORIES)[number];

export const OUTCOMES = ['Treated and sent home', 'Medication given', 'Referred to hospital', 'Follow-up needed', 'Other'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
] as const;
export type Province = (typeof PROVINCES)[number];

export const PAPER_FILE_STATUSES = ['No paper file', 'Paper file - not yet digitised', 'Paper file - digitised'] as const;
export type PaperFileStatus = (typeof PAPER_FILE_STATUSES)[number];
