const test = require('node:test');
const assert = require('node:assert/strict');
const {
  browserDetails,
  isPublicIp,
  loginAlertHtml,
  sendPrivilegedLoginAlert,
} = require('../src/modules/auth/loginAlert');

test('login alert identifies common browsers and platforms', () => {
  assert.equal(browserDetails('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'), 'Google Chrome · Windows');
  assert.equal(browserDetails('Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'), 'Safari · macOS');
  assert.equal(browserDetails(''), 'Not provided · Unknown device');
});

test('GeoIP lookup is gated to public IPs and does not call an unconfigured provider', async () => {
  assert.equal(isPublicIp('203.0.113.7'), true);
  assert.equal(isPublicIp('192.168.1.12'), false);
  assert.equal(isPublicIp('127.0.0.1'), false);
  const previous = process.env.IP_GEOLOCATION_URL;
  delete process.env.IP_GEOLOCATION_URL;
  try {
    const delivered = [];
    await sendPrivilegedLoginAlert({
      email: 'hr@example.com',
      user: { id: 'employee-id', fullName: 'HR User', role: 'hr', companyId: 'company-id' },
      ipAddress: '203.0.113.7',
      userAgent: 'Chrome/120.0.0.0 (Windows NT 10.0)',
      sendCompanyMail: async (...args) => delivered.push(args),
    });
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0][0], 'company-id');
    assert.equal(delivered[0][1].to, 'hr@example.com');
    assert.match(delivered[0][1].html, /Location/);
    assert.match(delivered[0][1].html, /203\.0\.113\.7/);
    assert.match(delivered[0][1].html, /HR User/);
  } finally {
    if (previous === undefined) delete process.env.IP_GEOLOCATION_URL;
    else process.env.IP_GEOLOCATION_URL = previous;
  }
});

test('login alert HTML escapes identity and IP data before including it in the email', () => {
  const html = loginAlertHtml({
    email: '<script>@example.com',
    name: '<img src=x onerror=alert(1)>',
    role: 'super_admin',
    ipAddress: '198.51.100.1',
    browser: 'Chrome · Windows',
    location: 'Example City, Example Country',
    occurredAt: new Date('2026-10-23T12:00:00.000Z'),
  });
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
});
