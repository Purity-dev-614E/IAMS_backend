const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del();
  
  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 12);
  const supervisorPassword = await bcrypt.hash('supervisor123', 12);
  const studentPassword = await bcrypt.hash('student123', 12);
  
  // Generate UUIDs for users
  const adminId = uuidv4();
  const supervisor1Id = uuidv4();
  const supervisor2Id = uuidv4();
  const student1Id = uuidv4();
  const student2Id = uuidv4();
  const student3Id = uuidv4();
  
  // Insert seed entries
  await knex('users').insert([
    {
      id: adminId,
      name: 'System Administrator',
      email: 'admin@iams.edu',
      password_hash: adminPassword,
      role: 'admin'
    },
    {
      id: supervisor1Id,
      name: 'Dr. Sarah Johnson',
      email: 's.johnson@iams.edu',
      password_hash: supervisorPassword,
      role: 'uni_supervisor'
    },
    {
      id: supervisor2Id,
      name: 'Dr. Michael Chen',
      email: 'm.chen@iams.edu',
      password_hash: supervisorPassword,
      role: 'uni_supervisor'
    },
    {
      id: student1Id,
      name: 'Alice Kimani',
      email: 'alice.kimani@student.iams.edu',
      password_hash: studentPassword,
      role: 'student'
    },
    {
      id: student2Id,
      name: 'Bob Ochieng',
      email: 'bob.ochieng@student.iams.edu',
      password_hash: studentPassword,
      role: 'student'
    },
    {
      id: student3Id,
      name: 'Carol Wanjiku',
      email: 'carol.wanjiku@student.iams.edu',
      password_hash: studentPassword,
      role: 'student'
    }
  ]);
  
  // Store UUIDs for use in other seed files
  global.seedUUIDs = {
    admin: adminId,
    supervisor1: supervisor1Id,
    supervisor2: supervisor2Id,
    student1: student1Id,
    student2: student2Id,
    student3: student3Id
  };
};
