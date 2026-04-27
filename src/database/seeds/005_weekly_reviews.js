exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('weekly_reviews').del();
  
  // Insert seed entries - weekly reviews for Alice Kimani (attachment_id: 1)
  // Week 1: Jan 8-12, 2024
  const week1Start = new Date('2024-01-08');
  const week1End = new Date('2024-01-12');
  
  // Week 2: Jan 15-19, 2024
  const week2Start = new Date('2024-01-15');
  const week2End = new Date('2024-01-19');
  
  await knex('weekly_reviews').insert([
    {
      id: 1,
      attachment_id: 1, // Alice Kimani
      week_number: 1,
      week_start_date: week1Start.toISOString().split('T')[0],
      week_end_date: week1End.toISOString().split('T')[0],
      status: 'complete',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      attachment_id: 1, // Alice Kimani
      week_number: 2,
      week_start_date: week2Start.toISOString().split('T')[0],
      week_end_date: week2End.toISOString().split('T')[0],
      status: 'uni_reviewed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 3,
      attachment_id: 2, // Bob Ochieng
      week_number: 1,
      week_start_date: week1Start.toISOString().split('T')[0],
      week_end_date: week1End.toISOString().split('T')[0],
      status: 'industry_reviewed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]);
};
