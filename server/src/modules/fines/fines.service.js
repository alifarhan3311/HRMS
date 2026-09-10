/**
 * modules/fines/fines.service.js
 * Business logic for HR-issued fines.
 */
const createHttpError = require('http-errors');
const Fine = require('./fine.model');
const Employee = require('../employees/employees.model');
const notificationService = require('../notifications/notifications.service');

function applicationUrl(path = '/') {
  const configured = process.env.APP_URL || process.env.CLIENT_URL
    || String(process.env.CORS_ALLOWED_ORIGINS || '').split(',')[0]
    || 'http://localhost:5173';
  return `${configured.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function fineEmailHtml({ employeeName, amount, reason, issuedByName, date }) {
  const portalUrl = applicationUrl('/fines');
  return `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#dc2626;padding:24px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.025em;">HR Penalty Notice</h1>
        <p style="color:#fecaca;margin:6px 0 0 0;font-size:14px;">Human Resources Management System</p>
      </div>
      <div style="padding:28px 24px;color:#1f2937;">
        <p style="font-size:16px;margin:0 0 16px 0;">Dear <strong>${employeeName}</strong>,</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 20px 0;color:#4b5563;">
          This is to inform you that a formal fine has been recorded against your employee record by HR.
        </p>
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px 20px;border-radius:8px;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;width:130px;"><strong>Fine Amount:</strong></td>
              <td style="padding:6px 0;color:#dc2626;font-size:18px;font-weight:700;">PKR ${Number(amount).toLocaleString('en-PK')}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;"><strong>Reason:</strong></td>
              <td style="padding:6px 0;color:#111827;font-weight:500;">${reason}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;"><strong>Issued Date:</strong></td>
              <td style="padding:6px 0;color:#111827;">${date}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;"><strong>Issued By:</strong></td>
              <td style="padding:6px 0;color:#111827;">${issuedByName || 'HR Department'}</td>
            </tr>
          </table>
        </div>
        <p style="font-size:13px;line-height:1.5;color:#6b7280;margin:0 0 24px 0;">
          This deduction may be reflected in your upcoming payroll cycle. You can view all penalty details and statuses on your HRMS portal at any time.
        </p>
        <div style="text-align:center;">
          <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;box-shadow:0 2px 4px rgba(220,38,38,0.2);">
            View Details in HRMS Portal
          </a>
        </div>
      </div>
      <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">
        &copy; ${new Date().getFullYear()} HR Management System · Auto-generated notice
      </div>
    </div>
  `;
}

/**
 * Issue a fine. Only HR / super_admin may call this.
 * Sends both an in-app notification and a styled email to the fined employee.
 */
async function issueFine({ employeeId, amount, reason, payrollMonth, payrollYear }, actor) {
  const employee = await Employee.findOne({
    _id: employeeId,
    companyId: actor.companyId,
    status: 'active',
  }).select('_id fullName email employeeCode companyId').lean();

  if (!employee) {
    throw createHttpError(404, 'Employee not found or is not active.');
  }

  const fine = await Fine.create({
    employeeId: employee._id,
    issuedBy: actor.id,
    companyId: actor.companyId,
    amount,
    reason,
    ...(payrollMonth && { payrollMonth }),
    ...(payrollYear  && { payrollYear }),
  });

  const formattedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const emailHtml = fineEmailHtml({
    employeeName: employee.fullName,
    amount,
    reason,
    issuedByName: actor.fullName || 'HR Department',
    date: formattedDate,
  });

  // Dispatch In-App Notification and Email
  await notificationService.createNotificationWithEmail(
    {
      recipientId: employee._id,
      companyId:   actor.companyId,
      type:        'fine_issued',
      title:       'A fine has been issued against you',
      message:     `HR has issued a fine of PKR ${amount.toLocaleString()} against you. Reason: ${reason}`,
      link:        '/fines',
      metadata:    { fineId: fine._id, amount, reason },
      dedupeKey:   `fine:${fine._id}`,
    },
    {
      recipient: employee,
      subject: `[HR Notice] Fine Issued — PKR ${Number(amount).toLocaleString('en-PK')}`,
      html: emailHtml,
    }
  ).catch((err) => {
    console.error('Failed to dispatch fine notification / email:', err?.message || err);
  });

  return fine.populate([
    { path: 'employeeId', select: 'fullName employeeCode' },
    { path: 'issuedBy',   select: 'fullName employeeCode' },
  ]);
}

/**
 * List fines scoped to the caller's company.
 * HR/super_admin can filter by employeeId.
 */
async function listFines({ employeeId, page = 1, limit = 20 }, actor) {
  const filter = { companyId: actor.companyId, voidedAt: { $exists: false } };
  if (employeeId) filter.employeeId = employeeId;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Fine.find(filter)
      .populate('employeeId', 'fullName employeeCode profilePicture department designation')
      .populate('issuedBy',   'fullName employeeCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Fine.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
}

/**
 * Get fines issued specifically to the logged-in employee (self portal view).
 */
async function getMyFines({ page = 1, limit = 20 }, actor) {
  const filter = {
    employeeId: actor.id,
    companyId: actor.companyId,
    voidedAt: { $exists: false },
  };

  const skip = (page - 1) * limit;
  const [items, total, totalAgg] = await Promise.all([
    Fine.find(filter)
      .populate('issuedBy', 'fullName employeeCode designation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Fine.countDocuments(filter),
    Fine.aggregate([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
    ]),
  ]);

  const totalAmount = totalAgg[0]?.totalAmount || 0;

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    totalAmount,
  };
}

/**
 * Get a single fine by id (must belong to caller's company).
 */
async function getFineById(id, actor) {
  const fine = await Fine.findOne({ _id: id, companyId: actor.companyId })
    .populate('employeeId', 'fullName employeeCode profilePicture department designation')
    .populate('issuedBy',   'fullName employeeCode')
    .lean();
  if (!fine) throw createHttpError(404, 'Fine not found.');
  return fine;
}

/**
 * Void (soft-delete) a fine. Only HR / super_admin may call this.
 */
async function voidFine(id, { voidReason } = {}, actor) {
  const fine = await Fine.findOne({ _id: id, companyId: actor.companyId });
  if (!fine) throw createHttpError(404, 'Fine not found.');
  if (fine.voidedAt)  throw createHttpError(409, 'Fine has already been voided.');

  fine.voidedAt   = new Date();
  fine.voidedBy   = actor.id;
  fine.voidReason = voidReason || '';
  await fine.save();

  return fine;
}

module.exports = { issueFine, listFines, getMyFines, getFineById, voidFine };
