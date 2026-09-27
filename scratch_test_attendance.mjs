import fetch from 'node-fetch';

async function checkAttendance() {
  const url = 'http://localhost:5173/api/mssql-attendance?date=2026-09-27&siteId=all';
  console.log('Fetching:', url);
  const res = await fetch(url);
  const json = await res.json();
  console.log('Success:', !json.errorMessage, 'Total emps:', json.employees?.length);

  // Group employees by department/site and check company and designation
  const utopia = json.employees?.filter(e => e.department === 'Brigade Cornerstone Utopia' || e.empCode?.startsWith('31') || e.empCode?.startsWith('32')) || [];
  console.log('Total Utopia emps:', utopia.length);

  const companies = {};
  const roles = {};
  const rolesByCompany = {};

  utopia.forEach(e => {
    const comp = e.company || 'UNKNOWN';
    companies[comp] = (companies[comp] || 0) + 1;

    const desig = e.designation || e.role || 'UNKNOWN';
    roles[desig] = (roles[desig] || 0) + 1;

    if (!rolesByCompany[comp]) rolesByCompany[comp] = {};
    rolesByCompany[comp][desig] = (rolesByCompany[comp][desig] || 0) + 1;
  });

  console.log('Utopia Companies:', companies);
  console.log('Utopia Roles count:', Object.keys(roles).length);
  console.log('Utopia Roles:', roles);
  console.log('Roles by Company:', JSON.stringify(rolesByCompany, null, 2));

  // Check some sample employees
  console.log('Sample Utopia employees:', utopia.slice(0, 5).map(e => ({
    code: e.empCode,
    name: e.empName,
    company: e.company,
    role: e.role,
    designation: e.designation,
    department: e.department
  })));
}

checkAttendance();
