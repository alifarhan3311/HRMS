function isOnProbation(employee, now = new Date()) {
  if (!employee || employee.probationStatus === 'completed') return false;
  if (['ongoing', 'extended'].includes(employee.probationStatus)) return true;

  let endDate = employee.probationEndDate ? new Date(employee.probationEndDate) : null;
  if (!endDate && employee.joiningDate) {
    endDate = new Date(employee.joiningDate);
    endDate.setMonth(endDate.getMonth() + 3);
  }
  if (!endDate || Number.isNaN(endDate.getTime())) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  return endDate >= today;
}

module.exports = { isOnProbation };
