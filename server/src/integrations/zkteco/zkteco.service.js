const crypto = require('crypto');
const ZKLib = require('node-zklib');
const Employee = require('../../modules/employees/employees.model');
const attendanceService = require('../../modules/attendance/attendance.service');
const { emitToCompany } = require('../../config/socket');
const logger = require('../../utils/logger');
const { BiometricPunch, BiometricSyncState } = require('./biometricPunch.model');
const {
  isEventPacketTCP,
  isEventPacketUDP,
  decodeRecordRealTimeLog52,
  decodeRecordRealTimeLog18,
} = require('node-zklib/utils');
const { PACKET_SIZES } = require('node-zklib/constants');

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
  realtimeCleanup: null,
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
    reconcileInterval: Math.max(10000, Number(process.env.ZKTECO_RECONCILE_INTERVAL || 300000)),
    reconnectDelay: Math.max(1000, Number(process.env.ZKTECO_RECONNECT_DELAY || 2000)),
    timeout: Math.max(1000, Number(process.env.ZKTECO_TIMEOUT || 10000)),
    timezone: process.env.ZKTECO_TIMEZONE || 'Asia/Karachi',
    nativeRealtime: String(process.env.ZKTECO_NATIVE_REALTIME || 'true').toLowerCase() === 'true',
    biometricOffsetHours: Number(process.env.BIOMETRIC_TIME_OFFSET_HOURS || 0),
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

function applyBiometricTimeOffset(machineTimestamp, offsetHours = config().biometricOffsetHours) {
  const timestamp = new Date(machineTimestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Cannot correct an invalid biometric machine timestamp.');
  }
  if (!Number.isFinite(offsetHours)) {
    throw new Error('BIOMETRIC_TIME_OFFSET_HOURS must be a valid number.');
  }
  return new Date(timestamp.getTime() + (offsetHours * 60 * 60 * 1000));
}

function normalizePunch(event, source) {
  const cfg = config();
  const machineTimestamp = normalizeDeviceTime(
    event.attTime || event.recordTime || event.timestamp,
    cfg.timezone,
  );
  const correctedTimestamp = applyBiometricTimeOffset(
    machineTimestamp,
    cfg.biometricOffsetHours,
  );
  return {
    deviceUserId: String(event.userId ?? event.deviceUserId ?? event.userSn ?? '').trim(),
    machineTimestamp,
    correctedTimestamp,
    biometricOffsetHours: cfg.biometricOffsetHours,
    // Existing attendance service consumes punchTime. It always receives the
    // corrected timestamp; raw machine time remains audit-only.
    punchTime: correctedTimestamp,
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
    (punch.machineTimestamp || punch.punchTime).toISOString(),
    punch.verificationMode,
    punch.punchStatus,
  ].join('|')).digest('hex');
}

function inputFromStoredPunch(rawPunch) {
  return {
    deviceUserId: rawPunch.deviceUserId,
    machineTimestamp: rawPunch.machineTimestamp,
    correctedTimestamp: rawPunch.correctedTimestamp || rawPunch.punchTime,
    biometricOffsetHours: rawPunch.biometricOffsetHours,
    punchTime: rawPunch.punchTime,
    verificationMode: rawPunch.verificationMode,
    punchStatus: rawPunch.punchStatus,
    source: rawPunch.transportSource || 'polling',
    raw: rawPunch.raw,
  };
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

function pollingIntervalForMode(nativeRealtime, cfg = config()) {
  return nativeRealtime ? cfg.reconcileInterval : cfg.pollInterval;
}

function reconciliationCandidates(normalizedLogs, lastLogTime) {
  const cursor = new Date(lastLogTime || 0);
  const cursorTime = Number.isNaN(cursor.getTime()) ? 0 : cursor.getTime();
  return normalizedLogs.filter((item) => item.punchTime.getTime() > cursorTime);
}

function removeRealtimeListener() {
  if (state.realtimeCleanup) state.realtimeCleanup();
  state.realtimeCleanup = null;
}

// node-zklib only attaches its TCP callback when the socket has no existing
// data listeners. Command-response listeners already exist on a live client,
// so MB20-VL events can be registered successfully but never reach the app.
// Attach one service-owned event listener and remove it on every reconnect.
function attachRealtimeListener(zk, onEvent) {
  removeRealtimeListener();
  if (zk.connectionType === 'tcp') {
    const socket = zk.zklibTcp?.socket;
    if (!socket) throw new Error('TCP socket is unavailable for realtime attendance.');
    const listener = (data) => {
      try {
        if (isEventPacketTCP(data) && data.length > 16) onEvent(decodeRecordRealTimeLog52(data));
      } catch (error) {
        recordError('realtime-decode', error);
      }
    };
    socket.on('data', listener);
    state.realtimeCleanup = () => socket.removeListener('data', listener);
    return;
  }
  const socket = zk.zklibUdp?.socket;
  if (!socket) throw new Error('UDP socket is unavailable for realtime attendance.');
  const listener = (data) => {
    try {
      if (isEventPacketUDP(data) && data.length === PACKET_SIZES.REALTIME_LOG_UDP) {
        onEvent(decodeRecordRealTimeLog18(data));
      }
    } catch (error) {
      recordError('realtime-decode', error);
    }
  };
  socket.on('message', listener);
  state.realtimeCleanup = () => socket.removeListener('message', listener);
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

async function processPunch(input, storedPunch = null) {
  const cfg = config();
  if (!input.deviceUserId) {
    logger.warn('[zkteco] Attendance event ignored because device user ID is empty');
    return { duplicate: false, status: 'ignored' };
  }
  const fingerprint = punchFingerprint(input, deviceId(cfg));
  let rawPunch = storedPunch;
  if (!rawPunch) try {
    rawPunch = await BiometricPunch.create({
      fingerprint,
      deviceId: deviceId(cfg),
      deviceUserId: input.deviceUserId,
      machineTimestamp: input.machineTimestamp,
      correctedTimestamp: input.correctedTimestamp || input.punchTime,
      biometricOffsetHours: input.biometricOffsetHours ?? cfg.biometricOffsetHours,
      punchTime: input.punchTime,
      verificationMode: input.verificationMode,
      punchStatus: input.punchStatus,
      source: 'BIOMETRIC',
      transportSource: input.source,
      raw: input.raw,
      companyId: cfg.companyId,
    });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await BiometricPunch.findOne({ fingerprint });
      if (!existing || !['received', 'error', 'unmapped'].includes(existing.processingStatus)) {
        logger.info('[zkteco] Duplicate attendance event ignored', {
          deviceUserId: input.deviceUserId,
          punchTime: input.punchTime,
        });
        return { duplicate: true, status: 'ignored' };
      }
      rawPunch = existing;
    } else {
      throw error;
    }
  }

  try {
    rawPunch.processingAttempts = Number(rawPunch.processingAttempts || 0) + 1;
    rawPunch.lastProcessingAttempt = new Date();
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
    const ignored = result.action.endsWith('_ignored');
    rawPunch.processingStatus = ignored ? 'ignored' : 'processed';
    rawPunch.error = undefined;
    rawPunch.employeeId = employee._id;
    rawPunch.attendanceId = result.record._id;
    rawPunch.attendanceAction = result.action;
    await rawPunch.save();
    await advanceCursor(input.punchTime, cfg);

    logger.info(`[zkteco] Attendance ${ignored ? 'punch ignored' : result.action === 'sign_in' ? 'created' : 'updated'}`, {
      attendanceId: result.record._id,
      employeeId: employee._id,
      action: result.action,
    });
    if (!ignored) {
      emitToCompany(cfg.companyId, 'data:changed', dataChangedPayload(deviceId(cfg)));
      emitToCompany(cfg.companyId, 'attendance:biometric', {
        attendanceId: result.record._id,
        employeeId: employee._id,
        action: result.action,
        punchTime: input.punchTime,
      });
    }
    return { duplicate: false, status: rawPunch.processingStatus, ...result };
  } catch (error) {
    rawPunch.processingStatus = 'error';
    rawPunch.error = error.message;
    await rawPunch.save().catch(() => {});
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
  const downloadedLogs = response?.data || [];
  const normalizedLogs = downloadedLogs
    .map(item => {
      try { return normalizePunch(item, 'polling'); } catch (error) { recordError('normalize-log', error); return null; }
    })
    .filter(Boolean);
  const latestStoredPunch = await BiometricPunch.findOne({ deviceId: deviceId(cfg) })
    .sort({ punchTime: -1 })
    .select('punchTime')
    .lean();
  const durableCursor = [syncState.lastLogTime, syncState.initializedAt, latestStoredPunch?.punchTime]
    .filter(Boolean)
    .reduce((latest, value) => new Date(value) > latest ? new Date(value) : latest, new Date(0));
  // A partial SDK response is not a device-log-count snapshot. Count-based
  // slicing permanently missed new punches whenever an older prefix arrived.
  // The durable timestamp cursor plus fingerprint uniqueness is safe for full,
  // partial, restarted and repeated fetches.
  const candidateRecords = reconciliationCandidates(normalizedLogs, durableCursor);
  const records = [...new Map(
    candidateRecords.map(item => [punchFingerprint(item, deviceId(cfg)), item]),
  ).values()]
    .sort((a, b) => a.punchTime - b.punchTime);

  let processed = 0;
  const strandedPunches = await BiometricPunch.find({
    deviceId: deviceId(cfg),
    processingStatus: { $in: ['received', 'error', 'unmapped'] },
    punchTime: { $gte: syncState.initializedAt },
    createdAt: { $lte: new Date(Date.now() - 10_000) },
  }).sort({ punchTime: 1 }).limit(100);
  for (const rawPunch of strandedPunches) {
    const result = await processPunch(inputFromStoredPunch(rawPunch), rawPunch);
    if (!result.duplicate) processed += 1;
  }
  for (const punch of records) {
    const result = await processPunch(punch);
    if (!result.duplicate) processed += 1;
  }
  await BiometricSyncState.updateOne(
    { deviceId: deviceId(cfg) },
    {
      $set: {
        lastLogCount: Math.max(Number(syncState.lastLogCount || 0), downloadedLogs.length),
        lastDownloadedCount: downloadedLogs.length,
        lastSuccessfulSync: new Date(),
        ...(response?.err ? { lastPartialSync: new Date() } : {}),
      },
    },
  );
  logger.info('[zkteco] Attendance fetch completed', {
    downloaded: downloadedLogs.length,
    cursorTime: durableCursor,
    partial: Boolean(response?.err),
    newLogs: records.length,
    recoveredStrandedPunches: strandedPunches.length,
    processed,
  });
  return { fetched: records.length, processed };
}

function clearTimers() {
  clearTimeout(state.reconnectTimer);
  clearTimeout(state.pollTimer);
  state.reconnectTimer = null;
  state.pollTimer = null;
}

function scheduleReconnect(reason) {
  if (state.stopped || state.reconnectTimer) return;
  state.connected = false;
  removeRealtimeListener();
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
  clearTimeout(state.pollTimer);
  const cfg = config();
  const interval = pollingIntervalForMode(state.nativeRealtime, cfg);
  const poll = async () => {
    if (state.stopped || !state.connected) return;
    try {
      await syncNewLogs();
    } catch (error) {
      recordError('polling', error);
      scheduleReconnect(error.message);
      return;
    }
    state.pollTimer = setTimeout(poll, interval);
    state.pollTimer.unref();
  };
  state.pollTimer = setTimeout(poll, interval);
  state.pollTimer.unref();
  logger.info('[zkteco] Attendance reconciliation polling enabled', {
    intervalMs: interval,
    nativeRealtime: state.nativeRealtime,
  });
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
      biometricOffsetHours: cfg.biometricOffsetHours,
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
    if (!cfg.nativeRealtime) {
      state.nativeRealtime = false;
    } else try {
      const handleRealtimeEvent = event => {
        try {
          const punch = normalizePunch(event, 'realtime');
          processPunch(punch).catch(error => recordError('realtime-event', error));
        } catch (error) {
          recordError('realtime-normalize', error);
        }
      };
      attachRealtimeListener(zk, handleRealtimeEvent);
      // Registration still goes through the SDK; event decoding is handled by
      // the listener above to avoid the SDK listener-count defect.
      await enqueueSdk(() => zk.getRealTimeLogs(() => {}));
      state.nativeRealtime = true;
      logger.info('[zkteco] Native realtime attendance subscription active');
    } catch (error) {
      removeRealtimeListener();
      state.nativeRealtime = false;
      recordError('realtime-subscription', error);
    }
    // Native realtime delivery is not durable: the device can retain a punch
    // while dropping its live event. Polling always remains active as a
    // reconciliation channel and fingerprint uniqueness keeps it idempotent.
    startPolling();
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
  removeRealtimeListener();
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
    reconciliationPolling: Boolean(state.pollTimer),
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
  applyBiometricTimeOffset,
  punchFingerprint,
  inputFromStoredPunch,
  employeeMappingFilter,
  attendanceActionForRecord,
  nextReconnectDelay,
  pollingIntervalForMode,
  dataChangedPayload,
  reconciliationCandidates,
};
