import crypto from 'crypto';

export function sessionToken() {
  const s = process.env.SESSION_SECRET || '';
  return crypto.createHash('sha256').update('opshub:' + s).digest('hex');
}

export function checkPassword(pw) {
  const expected = process.env.OPSHUB_PASSWORD || '';
  if (!expected || typeof pw !== 'string') return false;
  const a = crypto.createHash('sha256').update(pw).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function configured() {
  return Boolean(process.env.OPSHUB_PASSWORD && process.env.SESSION_SECRET);
}
