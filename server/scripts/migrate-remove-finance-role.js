require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../src/modules/employees/employees.model');
const Expense = require('../src/modules/expenses/expenses.model');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms');

  const employees = await Employee.collection.updateMany(
    {
      $or: [
        { role: 'finance' },
        { email: /^finance\..+@hrms\.demo$/i, designation: 'Expense Administrator' },
      ],
    },
    {
      $set: {
        role: 'admin',
        status: 'inactive',
        department: 'Administration',
        designation: 'Former Finance Account (Disabled)',
      },
    },
  );

  const legacyExpenses = await Expense.find({ 'approvalChain.role': 'finance' });
  let expensesUpdated = 0;
  for (const expense of legacyExpenses) {
    const managerStep = expense.approvalChain.find(step => step.role === 'manager')
      || { stage: 1, role: 'manager', status: 'pending' };
    const legacyAdminStep = expense.approvalChain.find(step => step.role === 'admin');
    const legacyFinanceStep = expense.approvalChain.find(step => step.role === 'finance');
    const adminStep = legacyAdminStep || legacyFinanceStep
      || { stage: 2, role: 'admin', status: 'pending' };

    managerStep.stage = 1;
    managerStep.role = 'manager';
    adminStep.stage = 2;
    adminStep.role = 'admin';

    expense.approvalChain = [managerStep, adminStep];
    if (['pending', 'processing'].includes(expense.status)) {
      expense.currentStage = managerStep.status === 'approved' ? 2 : 1;
    } else {
      expense.currentStage = 2;
    }
    await expense.save();
    expensesUpdated += 1;
  }

  console.log(JSON.stringify({
    financeUsersDeactivated: employees.modifiedCount,
    expenseWorkflowsMigrated: expensesUpdated,
  }));
  await mongoose.disconnect();
}

migrate().catch(async error => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
