import "server-only";

type SignupAttemptState = {
  count: number;
  blockedUntil: number;
  firstAttemptAt: number;
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const BLOCK_MS = 10 * 60 * 1000;
const attempts = new Map<string, SignupAttemptState>();

function getState(key: string) {
  const current = attempts.get(key);

  if (!current) {
    return null;
  }

  const now = Date.now();

  if (current.firstAttemptAt + WINDOW_MS < now && current.blockedUntil < now) {
    attempts.delete(key);

    return null;
  }

  return current;
}

export function getExclusiveSignupThrottle(key: string) {
  const current = getState(key);

  if (!current) {
    return {blocked: false, retryAfterMs: 0};
  }

  const now = Date.now();

  if (current.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterMs: current.blockedUntil - now
    };
  }

  return {blocked: false, retryAfterMs: 0};
}

export function recordExclusiveSignupAttempt(key: string) {
  const now = Date.now();
  const current = getState(key) ?? {
    count: 0,
    blockedUntil: 0,
    firstAttemptAt: now
  };

  current.count += 1;

  if (current.count >= MAX_ATTEMPTS) {
    current.blockedUntil = now + BLOCK_MS;
  }

  attempts.set(key, current);
}

export function clearExclusiveSignupAttempts(key: string) {
  attempts.delete(key);
}

