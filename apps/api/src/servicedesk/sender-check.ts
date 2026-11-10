/**
 * Whether the receiving mail server confirmed the sender (E-168): DMARC passed, or DKIM or SPF
 * passed for the domain of the From address (relaxed alignment: same domain or a subdomain).
 * The server notes this in Authentication-Results headers; without them nothing is confirmed.
 */
export function senderVerified(authenticationResults: string[], from: string): boolean {
  const domain = from.split('@').pop()?.toLowerCase() ?? '';
  if (!domain) return false;
  const aligned = (other: string | undefined) => {
    const value = other
      ?.toLowerCase()
      .replace(/^.*@/, '')
      .replace(/[>"]+$/, '');
    return (
      Boolean(value) &&
      (value === domain || domain.endsWith(`.${value}`) || value?.endsWith(`.${domain}`))
    );
  };
  for (const header of authenticationResults) {
    // "mx.example.net; dkim=pass header.d=a.de; spf=pass smtp.mailfrom=x@a.de; dmarc=pass header.from=a.de"
    for (const part of header.split(';').map((entry) => entry.trim().toLowerCase())) {
      const method = /^(dmarc|dkim|spf)=(\w+)/.exec(part);
      if (method?.[2] !== 'pass') continue;
      const property = (name: string) => new RegExp(`\\b${name}=([^\\s;]+)`).exec(part)?.[1];
      if (
        method[1] === 'dmarc' &&
        (property('header\\.from') === undefined || aligned(property('header\\.from')))
      ) {
        return true;
      }
      if (method[1] === 'dkim' && aligned(property('header\\.d') ?? property('header\\.i')))
        return true;
      if (method[1] === 'spf' && aligned(property('smtp\\.mailfrom') ?? property('smtp\\.helo'))) {
        return true;
      }
    }
  }
  return false;
}
