const { v4: uuidv4 } = require('uuid');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('students').del();
  
  // Generate UUIDs for students
  const student1ProfileId = uuidv4();
  const student2ProfileId = uuidv4();
  const student3ProfileId = uuidv4();
  
  // Insert seed entries using UUIDs from users seed
  await knex('students').insert([
    {
      id: student1ProfileId,
      user_id: global.seedUUIDs.student1, // Alice Kimani
      reg_number: 'SCS/2021/001',
      program: 'Computer Science',
      year_of_study: 3,
      uni_supervisor_id: global.seedUUIDs.supervisor1 // Dr. Sarah Johnson
    },
    {
      id: student2ProfileId,
      user_id: global.seedUUIDs.student2, // Bob Ochieng
      reg_number: 'SCS/2021/002',
      program: 'Computer Science',
      year_of_study: 3,
      uni_supervisor_id: global.seedUUIDs.supervisor1 // Dr. Sarah Johnson
    },
    {
      id: student3ProfileId,
      user_id: global.seedUUIDs.student3, // Carol Wanjiku
      reg_number: 'SIT/2021/001',
      program: 'Information Technology',
      year_of_study: 3,
      uni_supervisor_id: global.seedUUIDs.supervisor2 // Dr. Michael Chen
    }
  ]);
  
  // Store student profile UUIDs for use in other seed files
  global.seedUUIDs.student1Profile = student1ProfileId;
  global.seedUUIDs.student2Profile = student2ProfileId;
  global.seedUUIDs.student3Profile = student3ProfileId;
};
