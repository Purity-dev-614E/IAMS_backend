exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('daily_logs').del();
  
  // Insert seed entries - 2 weeks of daily logs for Alice Kimani (attachment_id: 1)
  const dailyLogs = [];
  const startDate = new Date('2024-01-08');
  
  // Generate 2 weeks of daily logs (Monday-Friday only)
  for (let week = 0; week < 2; week++) {
    for (let day = 0; day < 5; day++) {
      const logDate = new Date(startDate);
      logDate.setDate(startDate.getDate() + (week * 7) + day);
      
      dailyLogs.push({
        attachment_id: 1,
        log_date: logDate.toISOString().split('T')[0],
        tasks_performed: `Day ${week * 5 + day + 1}: Worked on web application development, attended team meetings, and completed assigned tasks.`,
        skills_acquired: `Improved JavaScript skills, learned React framework, enhanced communication skills.`,
        observations: `Good progress on project deliverables. Team collaboration is effective.`,
        status: 'submitted',
        submitted_at: logDate.toISOString()
      });
    }
  }
  
  // Add some logs for Bob Ochieng (attachment_id: 2)
  for (let day = 0; day < 3; day++) {
    const logDate = new Date('2024-01-08');
    logDate.setDate(logDate.getDate() + day);
    
    dailyLogs.push({
      attachment_id: 2,
      log_date: logDate.toISOString().split('T')[0],
      tasks_performed: `Day ${day + 1}: Database design, API development, code review sessions.`,
      skills_acquired: `Advanced SQL techniques, REST API design, version control with Git.`,
      observations: `Strong technical skills demonstrated. Good attention to detail.`,
      status: day < 2 ? 'submitted' : 'draft',
      submitted_at: day < 2 ? logDate.toISOString() : null
    });
  }
  
  await knex('daily_logs').insert(dailyLogs);
};
