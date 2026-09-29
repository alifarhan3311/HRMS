const fs = require('fs');
const path = 'C:\\Users\\FarhanRaza\\Downloads\\HR MANAGEMENT SYSTEM\\HRMS\\client\\src\\features\\settings\\components\\ShiftSettings.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add imports
content = content.replace(
  "import { Clock3, Pencil, Plus, Power, Trash2 } from 'lucide-react';",
  "import { Clock3, Pencil, Plus, Power, Trash2, Users } from 'lucide-react';\nimport { Modal } from '../../../components/ui/Modal';\nimport { useListEmployeesQuery } from '../../employees/api/employees.api';"
);

// 2. Add hooks and states
content = content.replace(
  "  const { data, isLoading } = useListShiftsQuery();\n  const [createShift, { isLoading: creating }] = useCreateShiftMutation();",
  "  const { data, isLoading } = useListShiftsQuery();\n  const { data: employeesData } = useListEmployeesQuery({ limit: 1000, status: 'active' });\n  const [createShift, { isLoading: creating }] = useCreateShiftMutation();"
);

content = content.replace(
  "  const shifts = data?.data || [];\n  const set = (field, value) => setForm(previous => ({ ...previous, [field]: value }));",
  "  const [viewingShift, setViewingShift] = useState(null);\n  const shifts = data?.data || [];\n  const employees = employeesData?.items || [];\n\n  const employeesByShift = employees.reduce((acc, emp) => {\n    const shiftId = emp.shiftId?._id || emp.shiftId;\n    if (shiftId) {\n      if (!acc[shiftId]) acc[shiftId] = [];\n      acc[shiftId].push(emp);\n    }\n    return acc;\n  }, {});\n  const set = (field, value) => setForm(previous => ({ ...previous, [field]: value }));"
);

// 3. Update map render
content = content.replace(
  " shifts.map(shift => (\n          <div key={shift._id} className=\"flex flex-col gap-3 border-b border-border p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between\">\n            <div>\n              <div className=\"flex items-center gap-2\"><p className=\"font-medium\">{shift.name}</p><span className=\"rounded bg-muted px-2 py-0.5 text-xs\">{shift.code}</span><span className={`rounded-full px-2 py-0.5 text-xs ${shift.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{shift.isActive ? 'Active' : 'Inactive'}</span></div>",
  " shifts.map(shift => {\n          const shiftEmployees = employeesByShift[shift._id] || [];\n          return (\n          <div key={shift._id} className=\"flex flex-col gap-3 border-b border-border p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/10 cursor-pointer transition-colors\" onClick={() => setViewingShift(shift)}>\n            <div>\n              <div className=\"flex items-center gap-2\">\n                <p className=\"font-medium\">{shift.name}</p>\n                <span className=\"rounded bg-muted px-2 py-0.5 text-xs\">{shift.code}</span>\n                <span className={`rounded-full px-2 py-0.5 text-xs ${shift.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{shift.isActive ? 'Active' : 'Inactive'}</span>\n                <span className=\"flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600 font-medium\">\n                  <Users className=\"h-3 w-3\" /> {shiftEmployees.length}\n                </span>\n              </div>"
);

content = content.replace(
  "              <Button size=\"sm\" variant=\"outline\" onClick={() => edit(shift)} className=\"gap-1\"><Pencil className=\"h-3.5 w-3.5\" /> Edit</Button>",
  "              <Button size=\"sm\" variant=\"outline\" onClick={(e) => { e.stopPropagation(); edit(shift); }} className=\"gap-1\"><Pencil className=\"h-3.5 w-3.5\" /> Edit</Button>"
);
content = content.replace(
  "              <Button size=\"sm\" variant=\"outline\" onClick={() => updateShift({ id: shift._id, isActive: !shift.isActive })} className=\"gap-1\"><Power className=\"h-3.5 w-3.5\" /> {shift.isActive ? 'Deactivate' : 'Activate'}</Button>",
  "              <Button size=\"sm\" variant=\"outline\" onClick={(e) => { e.stopPropagation(); updateShift({ id: shift._id, isActive: !shift.isActive }); }} className=\"gap-1\"><Power className=\"h-3.5 w-3.5\" /> {shift.isActive ? 'Deactivate' : 'Activate'}</Button>"
);
content = content.replace(
  "              <Button size=\"sm\" variant=\"outline\" onClick={() => remove(shift)} className=\"text-destructive\"><Trash2 className=\"h-3.5 w-3.5\" /></Button>\n            </div>\n          </div>\n        ))}",
  "              <Button size=\"sm\" variant=\"outline\" onClick={(e) => { e.stopPropagation(); remove(shift); }} className=\"text-destructive\"><Trash2 className=\"h-3.5 w-3.5\" /></Button>\n            </div>\n          </div>\n        )})}"
);

// 4. Add modal at the end
const modalCode = `
      <Modal isOpen={!!viewingShift} onClose={() => setViewingShift(null)} title={viewingShift ? \`Employees in \${viewingShift.name}\` : ''} size="md">
        <div className="space-y-4">
          <div className="max-h-[60vh] overflow-y-auto">
            {viewingShift && (employeesByShift[viewingShift._id] || []).length > 0 ? (
              <div className="divide-y divide-border">
                {(employeesByShift[viewingShift._id] || []).map(emp => (
                  <div key={emp._id} className="flex justify-between items-center py-3">
                    <div>
                      <p className="font-medium text-sm">{emp.fullName}</p>
                      <p className="text-xs text-muted-foreground">{emp.employeeCode}</p>
                    </div>
                    <span className="text-xs bg-muted px-2 py-1 rounded-md capitalize">{emp.department}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">No active employees are assigned to this shift.</p>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setViewingShift(null)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}`;

content = content.replace("    </div>\n  );\n}", modalCode);

fs.writeFileSync(path, content);
console.log('Modified ShiftSettings.jsx');
