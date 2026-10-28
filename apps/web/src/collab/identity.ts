export interface CollabIdentity {
  name: string;
  color: string;
}

const COLORS = [
  '#e5484d',
  '#f76b15',
  '#d4a017',
  '#46a758',
  '#12a594',
  '#0090ff',
  '#8e4ec6',
  '#d6409f',
];
const STORAGE_KEY = 'tasklore.dev-identity';

function randomIdentity(): CollabIdentity {
  const number = Math.floor(100 + Math.random() * 900);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#0090ff';
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
