/**
 * modules/auth/login.controller.js
 * HTTP layer for login/refresh/logout — sets/clears the HttpOnly cookies.
 */
const loginService = require('./login.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const isProduction = process.env.NODE_ENV === 'production';
const cookieSameSite = process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'strict');
const accessTokenCookieMinutes = Math.max(
  5,
  Number.parseInt(process.env.ACCESS_TOKEN_COOKIE_MINUTES || '60', 10) || 60
);
const refreshTokenCookieDays = Math.max(
  1,
  Number.parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10) || 30
);
const ACCESS_TOKEN_COOKIE_MS = accessTokenCookieMinutes * 60 * 1000;
const REFRESH_TOKEN_COOKIE_MS = refreshTokenCookieDays * 24 * 60 * 60 * 1000;

const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProduction || cookieSameSite === 'none',
  sameSite: cookieSameSite,
};

const login = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, user } = await loginService.login({
    email: req.body.email,
    password: req.body.password,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });

  req.auditContext = {
    userId: user.id,
    companyId: user.companyId,
    action: 'auth.login',
    resourceType: 'auth',
    resourceId: String(user.id),
  };

  // Remove the old path-scoped cookie before issuing the new proxy-safe one.
  res.clearCookie('refreshToken', { ...COOKIE_OPTS, path: '/api/v1/auth/refresh' });
  res.cookie('accessToken', accessToken, { ...COOKIE_OPTS, maxAge: ACCESS_TOKEN_COOKIE_MS });
  res.cookie('refreshToken', refreshToken, {
    ...COOKIE_OPTS,
    maxAge: REFRESH_TOKEN_COOKIE_MS,
    path: '/',
  });

  res.status(200).json({ success: true, data: { user } });
});

const refresh = asyncHandler(async (req, res) => {
  const { accessToken } = await loginService.refresh({
    rawRefreshToken: req.cookies?.refreshToken,
  });
  res.cookie('accessToken', accessToken, { ...COOKIE_OPTS, maxAge: ACCESS_TOKEN_COOKIE_MS });
  res.status(200).json({ success: true });
});

const logout = asyncHandler(async (req, res) => {
  await loginService.logout({ rawRefreshToken: req.cookies?.refreshToken });
  res.clearCookie('accessToken', COOKIE_OPTS);
  res.clearCookie('refreshToken', { ...COOKIE_OPTS, path: '/' });
  res.clearCookie('refreshToken', { ...COOKIE_OPTS, path: '/api/v1/auth/refresh' });
  res.status(200).json({ success: true });
});

const me = asyncHandler(async (req, res) => {
  const user = await loginService.getCurrentUser(req.user.id);
  res.status(200).json({ success: true, data: { user } });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await loginService.updateProfile(req.user.id, req.body);
  res.status(200).json({ success: true, data: { user } });
});

const changePassword = asyncHandler(async (req, res) => {
  await loginService.changePassword(req.user.id, req.body);
  res.clearCookie('accessToken', COOKIE_OPTS);
  res.clearCookie('refreshToken', { ...COOKIE_OPTS, path: '/' });
  res.clearCookie('refreshToken', { ...COOKIE_OPTS, path: '/api/v1/auth/refresh' });
  res.status(200).json({ success: true, message: 'Password changed. Please sign in again.' });
});

const socketToken = asyncHandler(async (req, res) => {
  const token = loginService.createSocketToken(req.user);
  res.status(200).json({ success: true, data: { token, expiresIn: 900 } });
});

module.exports = { login, refresh, logout, me, updateProfile, changePassword, socketToken };
