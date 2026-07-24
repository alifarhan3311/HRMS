const crypto = require('crypto');
const ZKLib = require('node-zklib');
const Employee = require('../../modules/employees/employees.model');
const attendanceService = require('../../modules/attendance/attendance.service');
const { emitToCompany } = require('../../config/socket');
const logger = require('../../utils/logger');
const { BiometricPunch, BiometricSyncState } = require('./biometricPunch.model');

const sdkPackage = require('node-zklib/package.json');

const state = {
  device: null,
  connected: false,
  stopped: true,
  connecting: false,
  reconnectTimer: null,
  pollTimer: null,
  reconnectAttempt: 0,
  nativeRealtime: false,
  lastConnection: null,
  lastErrors: [],
  sdkQueue: Promise.resolve(),
};

function config() {
  return {
    enabled: String(process.env.ZKTECO_ENABLED || 'false').toLowerCase() === 'true',
    ip: process.env.ZKTECO_IP || '192.168.1.5',
    port: Number(process.env.ZKTECO_PORT || 4370),
    commKey: Number(process.env.ZKTECO_COMM_KEY || 0),
    companyId: process.env.ZKTECO_COMPANY_ID,
    pollInterval: Math.max(1000, Number(process.env.ZKTECO_POLL_INTERVAL || 5000)),
    reconnectDelay: Math.max(1000, Number(process.env.ZKTECO_RECONNECT_DELAY || 2000)),
    timeout: Math.max(1000, Number(process.env.ZKTECO_TIMEOUT || 10000)),
    timezone: process.env.ZKTECO_TIMEZONE || 'Asia/Karachi',
  };
}

function deviceId(cfg = config()) {
  return `${cfg.ip}:${cfg.port}`;
}

function recordError(scope, error) {
  const item = {
    scope,
    message: error?.err?.message || error?.message || String(error),
    code: error?.err?.code || error?.code,
    at: new Date(),
  };
  state.lastErrors = [item, ...state.lastErrors].slice(0, 20);
  logger.error('[zkteco] SDK error', item);
}

function enqueueSdk(operation) {
  const run = state.sdkQueue.catch(() => {}).then(operation);
  state.sdkQueue = run.catch(() => {});
  return run;
}

function timezoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
    return result;
  }, {});
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    - instant.getTime();
}

// node-zklib decodes the device's wall-clock components into the server's
// local timezone. Rebuild those components in the configured company timezone
// so cloud and on-prem servers produce the same UTC instant.
function normalizeDeviceTime(value, timeZone = config().timezone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Device returned an invalid attendance timestamp.');
  const wallClockAsUtc = new Date(Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(),
    date.getHours(), date.getMinutes(), date.getSeconds(),
  ));
  return new Date(wallClockAsUtc.getTime() - timezoneOffsetMs(wallClockAsUtc, timeZone));
}

function normalizePunch(event, source) {
  const punchTime = normalizeDeviceTime(event.attTime || event.recordTime || event.timestamp);
  return {
    deviceUserId: String(event.userId ?? event.deviceUserId ?? event.userSn ?? '').trim(),
    punchTime,
    verificationMode: String(event.verifyMode ?? event.verificationMode ?? event.type ?? 'unknown'),
    punchStatus: String(event.status ?? event.punch ?? event.inOut ?? 'unknown'),
    source,
    raw: {
      userId: event.userId,
      deviceUserId: event.deviceUserId,
      userSn: event.userSn,
      recordTime: event.recordTime,
      attTime: event.attTime,
      verifyMode: event.verifyMode,
      status: event.status,
    },
  };
}

function punchFingerprint(punch, id = deviceId()) {
  return crypto.createHash('sha256').update([
    id,
    punch.deviceUserId,
    punch.punchTime.toISOString(),
    punch.verificationMode,
    punch.punchStatus,
  ].join('|')).digest('hex');
}

function employeeMappingFilter(companyId, deviceUserId) {
  return { companyId, biometricDeviceUserId: String(deviceUserId), status: 'active' };
}

function attendanceActionForRecord(record) {
  if (!record?.signInTime) return 'sign_in';
  if (!record.signOutTime) return 'sign_out';
  return 'extra_punch_ignored';
}

function nextReconnectDelay(attempt, baseDelay) {
  return Math.min(baseDelay * (2 ** attempt), 60000);
}

function dataChangedPayload(id = deviceId(), now = new Date()) {
  return {
    resource: 'attendance',
    tags: ['Attendance', 'Dashboard', 'Reports', 'Payroll'],
    actorId: `zkteco:${id}`,
    changedAt: now.toISOString(),
  };
}

async function advanceCursor(punchTime, cfg = config()) {
  await BiometricSyncState.updateOne(
    { deviceId: deviceId(cfg) },
    {
      $max: { lastLogTime: punchTime },
      $set: { lastSuccessfulSync: new Date(), libraryUsed: `node-zklib@${sdkPackage.version}/${state.device?.connectionType || 'auto'}` },
      $setOnInsert: { companyId: cfg.companyId, initializedAt: new Date() },
    },
    { upsert: true },
  );
}

async function processPunch(input) {
  const cfg = config();
  if (!input.deviceUserId) {
    logger.warn('[zkteco] Attendance event ignored because device user ID is empty');
    return { duplicate: false, status: 'ignored' };
  }
  const fingerprint = punchFingerprint(input, deviceId(cfg));
  let rawPunch;
  try {
    rawPunch = await BiometricPunch.create({
      fingerprint,
      deviceId: deviceId(cfg),
      deviceUserId: input.deviceUserId,
      punchTime: input.punchTime,
      verificationMode: input.verificationMode,
      punchStatus: input.punchStatus,
      source: input.source,
      raw: input.raw,
      companyId: cfg.companyId,
    });
  } catch (error) {
    if (error.code === 11000) {
      logger.info('[zkteco] Duplicate attendance event ignored', {
        deviceUserId: input.deviceUserId,
        punchTime: input.punchTime,
      });
      return { duplicate: true, status: 'ignored' };
    }
    throw error;
  }

  try {
    logger.info('[zkteco] Attendance event received', {
      deviceUserId: input.deviceUserId,
      punchTime: input.punchTime,
      source: input.source,
    });
    const employee = await Employee.findOne(employeeMappingFilter(cfg.companyId, input.deviceUserId));
    if (!employee) {
      rawPunch.processingStatus = 'unmapped';
      rawPunch.error = 'UNMAPPED';
      await rawPunch.save();
      await advanceCursor(input.punchTime, cfg);
      logger.warn('[zkteco] Device user is UNMAPPED', { deviceUserId: input.deviceUserId });
      return { duplicate: false, status: 'unmapped' };
    }

    logger.info('[zkteco] Employee mapped', {
      deviceUserId: input.deviceUserId,
      employeeId: employee._id,
      employeeCode: employee.employeeCode,
    });
    const result = await attendanceService.ingestBiometricPunch({
      employee,
      punchTime: input.punchTime,
      punchKey: fingerprint,
      deviceId: deviceId(cfg),
      deviceUserId: input.deviceUserId,
    });
    rawPunch.processingStatus = result.action === 'extra_punch_ignored' ? 'ignored' : 'processed';
    rawPunch.employeeId = employee._id;
    rawPunch.attendanceId = result.record._id;
    rawPunch.attendanceAction = result.action;
    await rawPunch.save();
    await advanceCursor(input.punchTime, cfg);

    logger.info(`[zkteco] Attendance ${result.action === 'sign_in' ? 'created' : 'updated'}`, {
      attendanceId: result.record._id,
      employeeId: employee._id,
      action: result.action,
    });
    emitToCompany(cfg.companyId, 'data:changed', dataChangedPayload(deviceId(cfg)));
    emitToCompany(cfg.companyId, 'attendance:biometric', {
      attendanceId: result.record._id,
      employeeId: employee._id,
      action: result.action,
      punchTime: input.punchTime,
    });
    return { duplicate: false, status: rawPunch.processingStatus, ...result };
  } catch (error) {
    rawPunch.processingStatus = 'error';
    rawPunch.error = error.message;
    await rawPunch.save().catch(() => {});
    await advanceCursor(input.punchTime, cfg).catch(() => {});
    recordError('process-punch', error);
    return { duplicate: false, status: 'error', error: error.message };
  }
}

async function syncNewLogs() {
  if (!state.connected || !state.device) return { fetched: 0, processed: 0 };
  const cfg = config();
  const syncState = await BiometricSyncState.findOneAndUpdate(
    { deviceId: deviceId(cfg) },
    {
      $setOnInsert: {
        companyId: cfg.companyId,
        initializedAt: new Date(),
        // First startup intentionally begins "now" so historical device logs
        // are not imported into a newly reset HRMS.
        lastLogTime: new Date(),
      },
    },
    { new: true, upsert: true },
  );
  const response = await enqueueSdk(() => state.device.getAttendances());
  if (response?.err) recordError('attendance-fetch-partial', response.err);
  const records = (response?.data || [])
    .map(item => {
      try { return normalizePunch(item, 'polling'); } catch (error) { recordError('normalize-log', error); return null; }
    })
    .filter(Boolean)
    .filter(item => item.punchTime > syncState.lastLogTime)
    .sort((a, b) => a.punchTime - b.punchTime);

  let processed = 0;
  for (const punch of records) {
    const result = await processPunch(punch);
    if (!result.duplicate) processed += 1;
  }
  logger.info('[zkteco] Attendance fetch completed', {
    downloaded: response?.data?.length || 0,
    newLogs: records.length,
    processed,
  });
  return { fetched: records.length, processed };
}

function clearTimers() {
  clearTimeout(state.reconnectTimer);
  clearInterval(state.pollTimer);
  state.reconnectTimer = null;
  state.pollTimer = null;
}

function scheduleReconnect(reason) {
  if (state.stopped || state.reconnectTimer) return;
  state.connected = false;
  const cfg = config();
  const delay = nextReconnectDelay(state.reconnectAttempt, cfg.reconnectDelay);
  state.reconnectAttempt += 1;
  logger.warn('[zkteco] Device disconnected; reconnect scheduled', { reason, delay, attempt: state.reconnectAttempt });
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    connect().catch(error => {
      recordError('reconnect', error);
      scheduleReconnect(error.message);
    });
  }, delay);
  state.reconnectTimer.unref();
}

function startPolling() {
  clearInterval(state.pollTimer);
  const cfg = config();
  state.pollTimer = setInterval(() => {
    syncNewLogs().catch(error => {
      recordError('polling', error);
      scheduleReconnect(error.message);
    });
  }, cfg.pollInterval);
  state.pollTimer.unref();
  logger.info('[zkteco] Native realtime unavailable; polling fallback enabled', { intervalMs: cfg.pollInterval });
}

async function connect() {
  const cfg = config();
  if (state.stopped || state.connecting || state.connected) return;
  if (!cfg.companyId) throw new Error('ZKTECO_COMPANY_ID is required when ZKTECO_ENABLED=true.');
  state.connecting = true;
  clearTimers();
  const zk = new ZKLib(cfg.ip, cfg.port, cfg.timeout, 4000, cfg.commKey);
  state.device = zk;
  try {
    await zk.createSocket(
      error => {
        recordError('socket', error);
        scheduleReconnect(error?.message || 'socket error');
      },
      () => scheduleReconnect('socket closed'),
    );
    state.connected = true;
    state.reconnectAttempt = 0;
    state.lastConnection = new Date();
    logger.info('[zkteco] Device connected', {
      deviceId: deviceId(cfg),
      transport: zk.connectionType,
      library: `node-zklib@${sdkPackage.version}`,
    });
    await BiometricSyncState.updateOne(
      { deviceId: deviceId(cfg) },
      {
        $set: {
          companyId: cfg.companyId,
          lastConnection: state.lastConnection,
          libraryUsed: `node-zklib@${sdkPackage.version}/${zk.connectionType}`,
        },
        $setOnInsert: { initializedAt: new Date(), lastLogTime: new Date() },
      },
      { upsert: true },
    );
    await syncNewLogs();
    try {
      await enqueueSdk(() => zk.getRealTimeLogs(event => {
        try {
          const punch = normalizePunch(event, 'realtime');
          processPunch(punch).catch(error => recordError('realtime-event', error));
        } catch (error) {
          recordError('realtime-normalize', error);
        }
      }));
      state.nativeRealtime = true;
      logger.info('[zkteco] Native realtime attendance subscription active');
    } catch (error) {
      state.nativeRealtime = false;
      recordError('realtime-subscription', error);
      startPolling();
    }
  } finally {
    state.connecting = false;
  }
}

async function startBiometricService() {
  const cfg = config();
  if (!cfg.enabled) {
    logger.info('[zkteco] Integration disabled by ZKTECO_ENABLED');
    return () => {};
  }
  state.stopped = false;
  connect().catch(error => {
    recordError('initial-connect', error);
    scheduleReconnect(error.message);
  });
  return stopBiometricService;
}

async function stopBiometricService() {
  state.stopped = true;
  state.connected = false;
  clearTimers();
  const device = state.device;
  state.device = null;
  if (device) await device.disconnect().catch(() => {});
  logger.info('[zkteco] Biometric service stopped');
}

async function testDeviceConnection() {
  const cfg = config();
  const errors = [];
  let probe = null;
  let connected = false;
  try {
    // Reuse the active connection to avoid devices/firmware that permit only
    // one SDK client at a time.
    probe = state.connected ? state.device : new ZKLib(cfg.ip, cfg.port, cfg.timeout, 4001, cfg.commKey);
    if (!state.connected) await probe.createSocket();
    connected = true;
    const { deviceInfo, users, attendances } = await enqueueSdk(async () => ({
      deviceInfo: await probe.getInfo(),
      users: await probe.getUsers(),
      attendances: await probe.getAttendances(),
    }));
    if (users?.err) errors.push(users.err.message || String(users.err));
    if (attendances?.err) errors.push(attendances.err.message || String(attendances.err));
    return {
      connected,
      deviceInfo,
      userCount: users?.data?.length || 0,
      attendanceCount: attendances?.data?.length || 0,
      sdkVersion: sdkPackage.version,
      libraryUsed: `node-zklib/${probe.connectionType || 'auto'}`,
      lastConnection: state.lastConnection,
      errors,
    };
  } catch (error) {
    errors.push(error?.err?.message || error.message);
    return {
      connected: false,
      deviceInfo: null,
      userCount: 0,
      attendanceCount: 0,
      sdkVersion: sdkPackage.version,
      libraryUsed: 'node-zklib',
      lastConnection: state.lastConnection,
      errors,
    };
  } finally {
    if (probe && probe !== state.device) await probe.disconnect().catch(() => {});
  }
}

function getServiceStatus() {
  return {
    connected: state.connected,
    nativeRealtime: state.nativeRealtime,
    lastConnection: state.lastConnection,
    errors: state.lastErrors,
    deviceId: deviceId(),
  };
}

module.exports = {
  startBiometricService,
  stopBiometricService,
  testDeviceConnection,
  getServiceStatus,
  processPunch,
  normalizePunch,
  punchFingerprint,
  employeeMappingFilter,
  attendanceActionForRecord,
  nextReconnectDelay,
  dataChangedPayload,
};
