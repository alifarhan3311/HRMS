// Save only edited employees. Historical rate/unit snapshots remain authoritative.
export function buildChangedSalesEntries(employees, commissions, values) {
  return employees.filter(employee => !employee.commissionLocked).flatMap(employee => {
    let changed = false;
    const products = Object.fromEntries(commissions.map(commission => {
      const previous = employee.salesCommission?.items?.find(item => item.slug === commission.slug);
      const input = values[employee._id]?.[commission.slug];
      const unit = previous?.unit ?? commission.unit;
      const quantity = Number(input?.quantity ?? previous?.quantity ?? 0);
      const salesAmount = unit === 'percent' ? Number(input?.salesAmount ?? previous?.salesAmount ?? 0) : 0;
      if (quantity !== Number(previous?.quantity || 0) || salesAmount !== Number(previous?.salesAmount || 0)) changed = true;
      return [commission.slug, { quantity, salesAmount }];
    }));
    return changed ? [{ employeeId: employee._id, products }] : [];
  });
}
