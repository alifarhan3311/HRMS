/**
 * modules/auth/auth.routes.js
 * Public login/refresh + protected logout/me, plus admin session-CRUD
 * (view/revoke active sessions) mounted under the same router.
 */
const express = require('express');
const loginController = require('./login.controller');
const sessionController = require('./auth.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { profileUpdateSchema, changePasswordSchema } = require('./auth.validation');

const router = express.Router();

// Public
router.post('/login', loginController.login);
router.post('/refresh', loginController.refresh);

// Requires a valid access token
router.post('/logout', authenticate, loginController.logout);
router.get('/me', authenticate, loginController.me);
router.patch('/profile', authenticate, validate(profileUpdateSchema), loginController.updateProfile);
router.patch('/change-password', authenticate, validate(changePasswordSchema), loginController.changePassword);
router.post('/socket-token', authenticate, loginController.socketToken);

// Admin session management
router.get('/sessions', authenticate, authorize('admin', 'super_admin'), sessionController.list);
router.delete('/sessions/:id', authenticate, authorize('admin', 'super_admin'), sessionController.remove);

module.exports = router;
