function normalizeWorkMode(value) {
  return value === 'wfh' ? 'wfh' : 'office';
}

function canUseSelfServiceSignIn(employee) {
  return normalizeWorkMode(employee?.workMode) === 'wfh';
}

function buildWorkModeFilter(workMode) {
  if (workMode === 'wfh') return { workMode: 'wfh' };
  if (workMode === 'office') {
    return {
      $or: [
        { workMode: 'office' },
        { workMode: { $exists: false } },
      ],
    };
  }
  return {};
}

module.exports = {
  normalizeWorkMode,
  canUseSelfServiceSignIn,
  buildWorkModeFilter,
};
