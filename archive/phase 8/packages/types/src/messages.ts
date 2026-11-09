/** The exact messages of the Check-in screens S3 and S4 (PRD 12.2). The web app and OP4 use the same words. */
export const CHECKIN_MESSAGES = {
  firstName: 'Please enter your first name.',
  surname: 'Please enter your surname.',
  dateOfBirth: 'Please enter a real date of birth, for example 14 / 08 / 1997.',
  idNumber: 'This ID number does not look right. Check it, or leave it empty if you do not have one.',
  cellphone: 'Enter a South African cellphone number, for example 082 555 0147, or leave it empty.',
  chooseYesNo: 'Please choose Yes or No.',
  reason: 'Please choose why you are here today.',
  consent: 'Please tick the box to agree to the Privacy Notice to check in.',
  tooMany: 'Too many Check-ins at once. Please wait one minute and try again.',
} as const;
