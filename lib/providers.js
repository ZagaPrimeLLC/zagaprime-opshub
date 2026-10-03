// Brand-ish chip colors per provider slug (used by server + client components).
export const PCOLORS = {
  supabase: { c: '#3ecf8e', fg: '#06281a' },
  vercel: { c: '#444c63', fg: '#ffffff' },
  cloudflare: { c: '#f6821f', fg: '#2b1500' },
  neon: { c: '#00e599', fg: '#042a1d' },
  base44: { c: '#6c5ce7', fg: '#ffffff' },
  aws: { c: '#ff9900', fg: '#2b1a00' },
  oracle: { c: '#c74634', fg: '#ffffff' },
  github: { c: '#57606a', fg: '#ffffff' },
  stripe: { c: '#635bff', fg: '#ffffff' },
  hostinger: { c: '#673de6', fg: '#ffffff' },
  n8n: { c: '#ea4b71', fg: '#ffffff' },
  bitwarden: { c: '#175ddc', fg: '#ffffff' },
  resend: { c: '#3b4253', fg: '#ffffff' },
};

export function pcolor(slug) {
  return PCOLORS[slug] || { c: 'var(--line2)', fg: 'var(--fg)' };
}
