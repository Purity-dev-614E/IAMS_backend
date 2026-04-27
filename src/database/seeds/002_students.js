exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('students').del();
  
  // Insert seed entries
  await knex('students').insert([
    {
      id: 1,
      user_id: 4, // Alice Kimani
      reg_number: 'SCS/2021/001',
      program: 'Computer Science',
      year_of_study: 3,
      uni_supervisor_id: 2 // Dr. Sarah Johnson
    },
    {
      id: 2,
      user_id: 5, // Bob Ochieng
      reg_number: 'SCS/2021/002',
      program: 'Computer Science',
      year_of_study: 3,
      uni_supervisor_id: 2 // Dr. Sarah Johnson
    },
    {
      id: 3,
      user_id: 6, // Carol Wanjiku
      reg_number: 'SIT/2021/001',
      program: 'Information Technology',
      year_of_study: 3,
      uni_supervisor_id: 3 // Dr. Michael Chen
    }
  ]);
};
