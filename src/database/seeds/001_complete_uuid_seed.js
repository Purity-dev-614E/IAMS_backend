const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

exports.seed = async function(knex) {
  // Deletes ALL existing entries in reverse order of dependencies
  await knex('reports').del();
  await knex('uni_feedback').del();
  await knex('industry_feedback').del();
  await knex('weekly_reviews').del();
  await knex('daily_logs').del();
  await knex('attachments').del();
  await knex('students').del();
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
  
  // Insert users
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
  
  // Generate UUIDs for student profiles
  const student1ProfileId = uuidv4();
  const student2ProfileId = uuidv4();
  const student3ProfileId = uuidv4();
  
  // Insert students
  await knex('students').insert([
    {
      id: student1ProfileId,
      user_id: student1Id, // Alice Kimani
      reg_number: 'SCS/2021/001',
      program: 'Computer Science',
      year_of_study: 3,
      uni_supervisor_id: supervisor1Id // Dr. Sarah Johnson
    },
    {
      id: student2ProfileId,
      user_id: student2Id, // Bob Ochieng
      reg_number: 'SCS/2021/002',
      program: 'Computer Science',
      year_of_study: 3,
      uni_supervisor_id: supervisor1Id // Dr. Sarah Johnson
    },
    {
      id: student3ProfileId,
      user_id: student3Id, // Carol Wanjiku
      reg_number: 'SIT/2021/001',
      program: 'Information Technology',
      year_of_study: 3,
      uni_supervisor_id: supervisor2Id // Dr. Michael Chen
    }
  ]);
  
  // Generate UUIDs for attachments
  const attachment1Id = uuidv4();
  const attachment2Id = uuidv4();
  const attachment3Id = uuidv4();
  
  // Insert attachments
  await knex('attachments').insert([
    {
      id: attachment1Id,
      student_id: student1ProfileId, // Alice Kimani
      organization_name: 'Tech Solutions Kenya',
      industry_supervisor_name: 'James Mwangi',
      industry_supervisor_email: 'j.mwangi@techsolutions.co.ke',
      start_date: '2024-01-08',
      end_date: '2024-04-05',
      status: 'active'
    },
    {
      id: attachment2Id,
      student_id: student2ProfileId, // Bob Ochieng
      organization_name: 'Digital Innovations Ltd',
      industry_supervisor_name: 'Grace Njoroge',
      industry_supervisor_email: 'g.njoroge@digitalinnovations.com',
      start_date: '2024-01-08',
      end_date: '2024-04-05',
      status: 'active'
    },
    {
      id: attachment3Id,
      student_id: student3ProfileId, // Carol Wanjiku
      organization_name: 'Cyber Security Africa',
      industry_supervisor_name: 'David Mutua',
      industry_supervisor_email: 'd.mutua@cybersecurity.africa',
      start_date: '2024-01-15',
      end_date: '2024-04-12',
      status: 'active'
    }
  ]);
  
  // Generate some sample daily logs
  const dailyLogs = [];
  const today = new Date();
  
  for (let i = 0; i < 10; i++) {
    const logDate = new Date(today);
    logDate.setDate(today.getDate() - i);
    
    dailyLogs.push({
      id: uuidv4(),
      attachment_id: attachment1Id,
      log_date: logDate.toISOString().split('T')[0],
      tasks_performed: `Day ${i + 1}: Worked on user authentication system and database design`,
      skills_acquired: `Day ${i + 1}: Improved JavaScript skills, learned about JWT authentication`,
      observations: `Day ${i + 1}: Team collaboration is going well, code reviews are helpful`,
      status: 'submitted',
      submitted_at: logDate
    });
  }
  
  await knex('daily_logs').insert(dailyLogs);
  
  // Generate some weekly reviews
  const weeklyReviews = [
    {
      id: uuidv4(),
      attachment_id: attachment1Id,
      week_number: 1,
      week_start_date: '2024-01-08',
      week_end_date: '2024-01-14',
      status: 'pending'
    },
    {
      id: uuidv4(),
      attachment_id: attachment1Id,
      week_number: 2,
      week_start_date: '2024-01-15',
      week_end_date: '2024-01-21',
      status: 'industry_reviewed'
    }
  ];
  
  await knex('weekly_reviews').insert(weeklyReviews);
  
  console.log('Database seeded successfully with UUIDs!');
};
