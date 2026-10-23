const net = require('node:net');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function browserDetails(userAgent = '') {
  const ua = String(userAgent);
  const browser = /Edg\//i.test(ua) ? 'Microsoft Edge'
    : /OPR\//i.test(ua) ? 'Opera'
      : /Firefox\//i.test(ua) ? 'Firefox'
        : /Chrome\//i.test(ua) ? 'Google Chrome'
          : /Safari\//i.test(ua) ? 'Safari'
            : ua ? 'Unknown browser' : 'Not provided';
  const platform = /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
      : /Android/i.test(ua) ? 'Android'
        : /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
          : /Linux/i.test(ua) ? 'Linux'
            : 'Unknown device';
  return `${browser} · ${platform}`;
}

function isPublicIp(ip) {
  const normalized = String(ip || '').replace(/^::ffff:/i, '');
  const version = net.isIP(normalized);
  if (version === 4) {
    const octets = normalized.split('.').map(Number);
    const [first, second] = octets;
    return !(first === 0 || first === 10 || first === 127 || first >= 224
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168));
  }
  if (version === 6) {
    const value = normalized.toLowerCase();
    return value !== '::1' && !value.startsWith('fc') && !value.startsWith('fd') && !value.startsWith('fe80:');
  }
  return false;
}

async function lookupApproximateLocation(ipAddress) {
  const endpointTemplate = process.env.IP_GEOLOCATION_URL;
  if (!endpointTemplate || !endpointTemplate.includes('{ip}') || !isPublicIp(ipAddress)) {
    return 'Unavailable (IP geolocation is not configured or this is a private IP)';
  }

  let endpoint;
  try {
    endpoint = new URL(endpointTemplate.replaceAll('{ip}', encodeURIComponent(ipAddress)));
  } catch {
    return 'Unavailable (IP geolocation endpoint is invalid)';
  }
  if (endpoint.protocol !== 'https:') return 'Unavailable (IP geolocation endpoint must use HTTPS)';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) return 'Unavailable (IP geolocation lookup failed)';
    const data = await response.json();
    const location = [data.city, data.region || data.region_name, data.country_name || data.country]
      .filter(value => typeof value === 'string' && value.trim())
      .map(value => value.trim().slice(0, 100));
    return location.length ? `${location.join(', ')} (approximate, based on IP)` : 'Unavailable (no location returned)';
  } catch {
    return 'Unavailable (IP geolocation lookup failed)';
  } finally {
    clearTimeout(timeout);
  }
}

function loginAlertHtml({ email, name, role, ipAddress, browser, location, occurredAt }) {
  const details = [
    ['Account', name],
    ['Email', email],
    ['Role', role],
    ['Location', location],
    ['IP address', ipAddress || 'Not available'],
    ['Browser / device', browser],
    ['Time', occurredAt.toISOString()],
  ];
  const rows = details.map(([label, value]) => `<tr><td style="padding:8px 12px;color:#666">${escapeHtml(label)}</td><td style="padding:8px 12px;font-weight:600">${escapeHtml(value)}</td></tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#222"><h2>HRMS security alert: successful login</h2><p>A privileged account has just signed in. If this was not you, contact your system administrator and secure your account.</p><table style="border-collapse:collapse;width:100%">${rows}</table><p style="margin-top:20px;color:#666;font-size:12px">Location is approximate and inferred from the public IP address when a GeoIP provider is configured. Never reply with your password or verification codes.</p></div>`;
}

async function sendPrivilegedLoginAlert({ email, user, ipAddress, userAgent, sendCompanyMail }) {
  const location = await lookupApproximateLocation(ipAddress);
  const occurredAt = new Date();
  await sendCompanyMail(user.companyId, {
    to: email,
    subject: 'HRMS security alert: successful privileged-account login',
    html: loginAlertHtml({
      email,
      name: user.fullName || 'Unknown user',
      role: user.role,
      ipAddress,
      browser: browserDetails(userAgent),
      location,
      occurredAt,
    }),
  });
}

module.exports = { browserDetails, isPublicIp, lookupApproximateLocation, loginAlertHtml, sendPrivilegedLoginAlert };
