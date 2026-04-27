const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del();
  
  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const supervisorPassword = await bcrypt.hash('supervisor123', 10);
  const studentPassword = await bcrypt.hash('student123', 10);
  
  // Insert seed entries
  await knex('users').insert([
    {
      id: 1,
      name: 'System Administrator',
      email: 'admin@iams.edu',
      password_hash: adminPassword,
      role: 'admin'
    },
    {
      id: 2,
      name: 'Dr. Sarah Johnson',
      email: 's.johnson@iams.edu',
      password_hash: supervisorPassword,
      role: 'uni_supervisor'
    },
    {
      id: 3,
      name: 'Dr. Michael Chen',
      email: 'm.chen@iams.edu',
      password_hash: supervisorPassword,
      role: 'uni_supervisor'
    },
    {
      id: 4,
      name: 'Alice Kimani',
      email: 'alice.kimani@student.iams.edu',
      password_hash: studentPassword,
      role: 'student'
    },
    {
      id: 5,
      name: 'Bob Ochieng',
      email: 'bob.ochieng@student.iams.edu',
      password_hash: studentPassword,
      role: 'student'
    },
    {
      id: 6,
      name: 'Carol Wanjiku',
      email: 'carol.wanjiku@student.iams.edu',
      password_hash: studentPassword,
      role: 'student'
    }
  ]);
};
