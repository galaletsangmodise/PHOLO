/** The four account roles (PRD 5) and what each may open (plan Sections 7.3 and 11). */
export type Role = 'Check-in' | 'Reception' | 'Clinical' | 'Manager';

/** S2 for Check-in, S6 for Reception and Clinical, S10 for Manager. */
export function mainScreenFor(role: Role): string {
  switch (role) {
    case 'Check-in':
      return '/checkin';
    case 'Manager':
      return '/summary';
    default:
      return '/queue';
  }
}

const startsWithSegment = (pathname: string, base: string): boolean => pathname === base || pathname.startsWith(`${base}/`);

/** True when the role may open the route. Routes the plan does not list (such as /login) are decided elsewhere. */
export function canOpen(role: Role, pathname: string): boolean {
  if (startsWithSegment(pathname, '/checkin')) return role === 'Check-in';
  if (startsWithSegment(pathname, '/queue') || startsWithSegment(pathname, '/patients')) {
    return role === 'Reception' || role === 'Clinical';
  }
  if (startsWithSegment(pathname, '/visits')) return role === 'Clinical';
  if (startsWithSegment(pathname, '/summary')) return role === 'Manager';
  return true;
}
