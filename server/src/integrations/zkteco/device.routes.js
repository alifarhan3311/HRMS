const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { testDeviceConnection, getServiceStatus } = require('./zkteco.service');

const router = express.Router();

router.use(authenticate, authorize('hr', 'super_admin'));

router.get('/test', async (req, res, next) => {
  try {
    const result = await testDeviceConnection();
    res.status(result.connected ? 200 : 503).json({
      success: result.connected,
      ...result,
      service: getServiceStatus(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
