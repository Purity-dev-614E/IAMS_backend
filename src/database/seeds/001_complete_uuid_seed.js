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
  
  // Generate realistic dates for attachments (8-12 weeks ago from today)
  const today = new Date();
  const attachmentStartDate = new Date(today);
  attachmentStartDate.setDate(today.getDate() - 84); // 12 weeks ago
  const attachmentEndDate = new Date(attachmentStartDate);
  attachmentEndDate.setDate(attachmentStartDate.getDate() + 84); // 12 weeks duration
  
  // Generate UUIDs for attachments
  const attachment1Id = uuidv4();
  const attachment2Id = uuidv4();
  const attachment3Id = uuidv4();
  
  // Insert attachments with realistic dates
  await knex('attachments').insert([
    {
      id: attachment1Id,
      student_id: student1ProfileId, // Alice Kimani
      organization_name: 'Tech Solutions Kenya',
      industry_supervisor_name: 'James Mwangi',
      industry_supervisor_email: 'j.mwangi@techsolutions.co.ke',
      start_date: attachmentStartDate.toISOString().split('T')[0],
      end_date: attachmentEndDate.toISOString().split('T')[0],
      status: 'active'
    },
    {
      id: attachment2Id,
      student_id: student2ProfileId, // Bob Ochieng
      organization_name: 'Digital Innovations Ltd',
      industry_supervisor_name: 'Grace Njoroge',
      industry_supervisor_email: 'g.njoroge@digitalinnovations.com',
      start_date: attachmentStartDate.toISOString().split('T')[0],
      end_date: attachmentEndDate.toISOString().split('T')[0],
      status: 'active'
    },
    {
      id: attachment3Id,
      student_id: student3ProfileId, // Carol Wanjiku
      organization_name: 'Cyber Security Africa',
      industry_supervisor_name: 'David Mutua',
      industry_supervisor_email: 'd.mutua@cybersecurity.africa',
      start_date: attachmentStartDate.toISOString().split('T')[0],
      end_date: attachmentEndDate.toISOString().split('T')[0],
      status: 'active'
    }
  ]);
  
  // Generate realistic daily logs over the past 8-12 weeks
  const dailyLogs = [];
  const logsStartDate = new Date(attachmentStartDate);
  
  // Generate logs for the past 8 weeks (56 days)
  for (let i = 0; i < 56; i++) {
    const logDate = new Date(logsStartDate);
    logDate.setDate(logsStartDate.getDate() + i);
    
    // Skip weekends
    if (logDate.getDay() === 0 || logDate.getDay() === 6) continue;
    
    dailyLogs.push({
      id: uuidv4(),
      attachment_id: attachment1Id,
      log_date: logDate.toISOString().split('T')[0],
      tasks_performed: `Day ${Math.floor(i/7) + 1}: Developed RESTful APIs, implemented authentication middleware, optimized database queries`,
      skills_acquired: `Day ${Math.floor(i/7) + 1}: Enhanced Node.js skills, learned PostgreSQL optimization, improved API design patterns`,
      observations: `Day ${Math.floor(i/7) + 1}: Agile sprint planning effective, code reviews improving quality, mentorship from senior developers valuable`,
      status: 'submitted',
      submitted_at: logDate
    });
  }
  
  await knex('daily_logs').insert(dailyLogs);
  
  // Generate weekly reviews for all 12 weeks
  const weeklyReviews = [];
  for (let week = 1; week <= 12; week++) {
    const weekStart = new Date(attachmentStartDate);
    weekStart.setDate(attachmentStartDate.getDate() + (week - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // Determine status based on how recent the week is
    let status = 'pending';
    if (week < 8) {
      status = 'complete';
    } else if (week < 10) {
      status = 'industry_reviewed';
    } else if (week < 12) {
      status = 'uni_reviewed';
    }
    
    weeklyReviews.push({
      id: uuidv4(),
      attachment_id: attachment1Id,
      week_number: week,
      week_start_date: weekStart.toISOString().split('T')[0],
      week_end_date: weekEnd.toISOString().split('T')[0],
      status: status
    });
  }
  
  await knex('weekly_reviews').insert(weeklyReviews);
  
  console.log('Database seeded successfully with UUIDs!');
};
