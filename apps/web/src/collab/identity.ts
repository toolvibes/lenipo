export interface CollabIdentity {
  name: string;
  color: string;
}

/** Presence colors from the design system (`presence-1` … `presence-6`); white text on each passes AA. */
const COLORS = ['#b3372b', '#9c4a00', '#2d6b2d', '#0d6475', '#4a4fb0', '#953374'];
const STORAGE_KEY = 'tasklore.dev-identity';

function randomIdentity(): CollabIdentity {
  const number = Math.floor(100 + Math.random() * 900);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#0d6475';
  return { name: `Gast ${number}`, color };
}

/**
 * Temporary identity until login exists. Kept per browser tab (sessionStorage), so two
 * tabs show up as two different people.
 */
export function getDevIdentity(): CollabIdentity {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as CollabIdentity;
    }
  } catch {
    // Storage unavailable (private mode etc.): fall through to a fresh identity.
  }
  const identity = randomIdentity();
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Not persisted; a reload will create a new identity.
  }
  return identity;
}
