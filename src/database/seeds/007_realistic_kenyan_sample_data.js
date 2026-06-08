const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const toDateOnly = (date) => date.toISOString().split('T')[0];

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const samplePassword = async () => bcrypt.hash('password123', 12);

const clearExistingData = async (knex) => {
  const tables = [
    'attachment_eligibility_reviews',
    'end_of_attachment_reports',
    'refresh_tokens',
    'reports',
    'uni_feedback',
    'industry_feedback',
    'weekly_reviews',
    'daily_logs',
    'attachments',
    'students',
    'users'
  ];

  for (const table of tables) {
    if (await knex.schema.hasTable(table)) {
      await knex(table).del();
    }
  }
};

const ensureUser = async (knex, user, passwordHash) => {
  const existing = await knex('users').where({ email: user.email }).first();

  if (existing) {
    await knex('users')
      .where({ id: existing.id })
      .update({
        name: user.name,
        role: user.role,
        status: user.status || 'active',
        staff_id: user.staff_id || existing.staff_id || null,
        updated_at: knex.fn.now()
      });

    return existing.id;
  }

  const [created] = await knex('users')
    .insert({
      id: crypto.randomUUID(),
      name: user.name,
      email: user.email,
      staff_id: user.staff_id || null,
      password_hash: passwordHash,
      role: user.role,
      status: user.status || 'active'
    })
    .returning('id');

  return created.id || created;
};

const ensureStudent = async (knex, student) => {
  const existing = await knex('students')
    .where({ reg_number: student.reg_number })
    .first();

  if (existing) {
    await knex('students')
      .where({ id: existing.id })
      .update({
        user_id: student.user_id,
        program: student.program,
        year_of_study: student.year_of_study,
        uni_supervisor_id: student.uni_supervisor_id,
        updated_at: knex.fn.now()
      });

    return existing.id;
  }

  const [created] = await knex('students')
    .insert({
      id: crypto.randomUUID(),
      ...student
    })
    .returning('id');

  return created.id || created;
};

const ensureAttachment = async (knex, attachment) => {
  const existing = await knex('attachments')
    .where({
      student_id: attachment.student_id,
      organization_name: attachment.organization_name
    })
    .first();

  if (existing) {
    await knex('attachments')
      .where({ id: existing.id })
      .update({
        industry_supervisor_name: attachment.industry_supervisor_name,
        industry_supervisor_email: attachment.industry_supervisor_email,
        start_date: attachment.start_date,
        end_date: attachment.end_date,
        status: attachment.status,
        updated_at: knex.fn.now()
      });

    return existing.id;
  }

  const [created] = await knex('attachments')
    .insert({
      id: crypto.randomUUID(),
      ...attachment
    })
    .returning('id');

  return created.id || created;
};

const ensureDailyLog = async (knex, log) => {
  const existing = await knex('daily_logs')
    .where({
      attachment_id: log.attachment_id,
      log_date: log.log_date
    })
    .first();

  if (existing) return existing.id;

  const [created] = await knex('daily_logs')
    .insert({
      id: crypto.randomUUID(),
      ...log
    })
    .returning('id');

  return created.id || created;
};

const ensureWeeklyReview = async (knex, review) => {
  const existing = await knex('weekly_reviews')
    .where({
      attachment_id: review.attachment_id,
      week_number: review.week_number
    })
    .first();

  if (existing) {
    await knex('weekly_reviews')
      .where({ id: existing.id })
      .update({
        week_start_date: review.week_start_date,
        week_end_date: review.week_end_date,
        status: review.status,
        updated_at: knex.fn.now()
      });

    return existing.id;
  }

  const [created] = await knex('weekly_reviews')
    .insert({
      id: crypto.randomUUID(),
      ...review,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    })
    .returning('id');

  return created.id || created;
};

const buildLogs = (student, attachmentId, startDate, count) => {
  const logs = [];
  let dayOffset = 0;

  while (logs.length < count) {
    const logDate = addDays(startDate, dayOffset);
    dayOffset += 1;

    if ([0, 6].includes(logDate.getDay())) continue;

    const submitted = logs.length < Math.max(2, count - 1);
    const activity = student.activities[logs.length % student.activities.length];

    logs.push({
      attachment_id: attachmentId,
      log_date: toDateOnly(logDate),
      tasks_performed: activity.tasks,
      skills_acquired: activity.skills,
      observations: activity.observations,
      status: submitted ? 'submitted' : 'draft',
      submitted_at: submitted ? logDate : null
    });
  }

  return logs;
};

exports.seed = async function(knex) {
  await clearExistingData(knex);

  const passwordHash = await samplePassword();

  const supervisors = [
    {
      name: 'Dr. Mercy Achieng',
      email: 'puritysang180@gmail.com',
      staff_id: 'STF101'
    },
    {
      name: 'Dr. Peter Kiptoo',
      email: 'puritysang180+kiptoo@gmail.com',
      staff_id: 'STF102'
    },
    {
      name: 'Dr. Wairimu Njenga',
      email: 'puritysang180+njenga@gmail.com',
      staff_id: 'STF103'
    }
  ];

  const supervisorIds = [];
  for (const supervisor of supervisors) {
    supervisorIds.push(await ensureUser(knex, {
      ...supervisor,
      role: 'uni_supervisor',
      status: 'active'
    }, passwordHash));
  }

  await ensureUser(knex, {
    name: 'System Administrator',
    email: 'admin@iams.edu',
    role: 'admin',
    status: 'active'
  }, passwordHash);

  const today = new Date();
  const students = [
    ['Amina Njeri', 'akiru5199@gmail.com', 'SCS/2022/014', 'Computer Science', 'Safaricom PLC', 'Janet Wambui', 'puritysang180+janet@gmail.com', -70, 14, 'active'],
    ['Brian Otieno', 'akiru5199+brian@gmail.com', 'SIT/2022/025', 'Information Technology', 'Kenya Revenue Authority', 'Samuel Kimutai', 'puritysang180+samuel@gmail.com', -42, 12, 'active'],
    ['Charity Wambui', 'akiru5199+charity@gmail.com', 'SCS/2022/033', 'Computer Science', 'Equity Bank Kenya', 'Irene Nyambura', 'puritysang180+irene@gmail.com', -98, 10, 'completed'],
    ['Daniel Kipchumba', 'akiru5199+daniel@gmail.com', 'SWE/2022/011', 'Software Engineering', 'Cellulant Kenya', 'Patrick Onyango', 'puritysang180+patrick@gmail.com', -21, 6, 'active'],
    ['Esther Muthoni', 'akiru5199+esther@gmail.com', 'SIT/2022/041', 'Information Technology', 'Nairobi City County ICT', 'Lucy Chebet', 'puritysang180+lucy@gmail.com', -7, 3, 'pending'],
    ['Felix Mwangi', 'akiru5199+felix@gmail.com', 'SCS/2022/052', 'Computer Science', 'KCB Group', 'George Kamau', 'puritysang180+george@gmail.com', -84, 15, 'completed'],
    ['Grace Anyango', 'akiru5199+grace@gmail.com', 'SWE/2022/019', 'Software Engineering', 'Twiga Foods', 'Diana Wekesa', 'puritysang180+diana@gmail.com', -35, 8, 'active'],
    ['Hassan Abdullahi', 'akiru5199+hassan@gmail.com', 'SIT/2022/063', 'Information Technology', 'Kenya Airways', 'Moses Kariuki', 'puritysang180+moses@gmail.com', -63, 11, 'active'],
    ['Ivy Chebet', 'akiru5199+ivy@gmail.com', 'SCS/2022/071', 'Computer Science', 'iHub Nairobi', 'Anne Muli', 'puritysang180+anne@gmail.com', -112, 9, 'inactive'],
    ['Joseph Mutiso', 'akiru5199+joseph@gmail.com', 'SWE/2022/028', 'Software Engineering', 'Andela Kenya', 'Victor Okello', 'puritysang180+victor@gmail.com', -49, 13, 'active'],
    ['Lilian Wangari', 'akiru5199+lilian@gmail.com', 'SIT/2022/086', 'Information Technology', 'M-Pesa Africa', 'Caroline Njoki', 'puritysang180+caroline@gmail.com', -77, 14, 'active'],
    ['Martin Ouma', 'akiru5199+martin@gmail.com', 'SCS/2022/094', 'Computer Science', 'Microsoft ADC Nairobi', 'Peter Omondi', 'puritysang180+peter@gmail.com', -91, 16, 'completed'],
    ['Naomi Wanjiku', 'akiru5199+naomi@gmail.com', 'SWE/2022/037', 'Software Engineering', 'Apollo Agriculture', 'Faith Nekesa', 'puritysang180+faith@gmail.com', -28, 7, 'active'],
    ['Oscar Koech', 'akiru5199+oscar@gmail.com', 'SIT/2022/105', 'Information Technology', 'Nation Media Group', 'Kevin Maina', 'puritysang180+kevin@gmail.com', -14, 4, 'pending'],
    ['Purity Nyambura', 'akiru5199+purity@gmail.com', 'SCS/2022/118', 'Computer Science', 'BRCK Kenya', 'Rose Atieno', 'puritysang180+rose@gmail.com', -56, 12, 'active']
  ].map(([name, email, regNumber, program, organization, industrySupervisor, industryEmail, startOffset, logCount, status], index) => ({
    name,
    email,
    reg_number: regNumber,
    program,
    organization,
    industrySupervisor,
    industryEmail,
    startDate: addDays(today, startOffset),
    endDate: addDays(today, startOffset + 84),
    logCount,
    status,
    yearOfStudy: index % 5 === 0 ? 4 : 3,
    supervisorId: supervisorIds[index % supervisorIds.length],
    activities: [
      {
        tasks: `Configured project tools and documented ${organization} workflow requirements with the ICT team.`,
        skills: 'Requirements gathering, professional communication, and ticket tracking.',
        observations: 'Clear acceptance criteria helped reduce rework during implementation.'
      },
      {
        tasks: `Built and tested a small feature for ${program.toLowerCase()} operations under supervisor review.`,
        skills: 'Debugging, code review discipline, and writing maintainable commits.',
        observations: 'Pairing with the team improved confidence with production code.'
      },
      {
        tasks: 'Prepared daily progress notes, joined a stand-up meeting, and resolved assigned support tasks.',
        skills: 'Incident triage, status reporting, and prioritising urgent requests.',
        observations: 'Most delays came from unclear handover notes between shifts.'
      },
      {
        tasks: 'Validated data entries, updated documentation, and presented progress to the industry supervisor.',
        skills: 'Data quality checks, documentation, and presentation skills.',
        observations: 'Regular feedback made the weekly objectives easier to measure.'
      }
    ]
  }));

  let totalLogs = 0;
  for (const student of students) {
    const userId = await ensureUser(knex, {
      name: student.name,
      email: student.email,
      role: 'student',
      status: 'active'
    }, passwordHash);

    const studentId = await ensureStudent(knex, {
      user_id: userId,
      reg_number: student.reg_number,
      program: student.program,
      year_of_study: student.yearOfStudy,
      uni_supervisor_id: student.supervisorId
    });

    const attachmentId = await ensureAttachment(knex, {
      student_id: studentId,
      organization_name: student.organization,
      industry_supervisor_name: student.industrySupervisor,
      industry_supervisor_email: student.industryEmail,
      start_date: toDateOnly(student.startDate),
      end_date: toDateOnly(student.endDate),
      status: student.status
    });

    const logs = buildLogs(student, attachmentId, student.startDate, student.logCount);
    for (const log of logs) {
      await ensureDailyLog(knex, log);
      totalLogs += 1;
    }

    const weeks = Math.max(1, Math.ceil(student.logCount / 5));
    for (let week = 1; week <= weeks; week++) {
      const weekStart = addDays(student.startDate, (week - 1) * 7);
      const reviewStatus = week < weeks - 1
        ? 'complete'
        : week === weeks - 1
          ? 'industry_reviewed'
          : student.status === 'pending'
            ? 'pending'
            : 'uni_reviewed';

      await ensureWeeklyReview(knex, {
        attachment_id: attachmentId,
        week_number: week,
        week_start_date: toDateOnly(weekStart),
        week_end_date: toDateOnly(addDays(weekStart, 6)),
        status: reviewStatus
      });
    }
  }

  console.log(`Added/updated Kenyan sample data: ${students.length} students, ${supervisors.length} supervisors, ${totalLogs} daily-log checks.`);
};
