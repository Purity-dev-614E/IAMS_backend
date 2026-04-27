exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('attachments').del();
  
  // Insert seed entries
  await knex('attachments').insert([
    {
      id: 1,
      student_id: 1, // Alice Kimani
      organization_name: 'Tech Solutions Kenya',
      industry_supervisor_name: 'James Mwangi',
      industry_supervisor_email: 'j.mwangi@techsolutions.co.ke',
      start_date: '2024-01-08',
      end_date: '2024-04-05',
      status: 'active'
    },
    {
      id: 2,
      student_id: 2, // Bob Ochieng
      organization_name: 'Digital Innovations Ltd',
      industry_supervisor_name: 'Grace Njoroge',
      industry_supervisor_email: 'g.njoroge@digitalinnovations.com',
      start_date: '2024-01-08',
      end_date: '2024-04-05',
      status: 'active'
    },
    {
      id: 3,
      student_id: 3, // Carol Wanjiku
      organization_name: 'Cyber Security Africa',
      industry_supervisor_name: 'David Mutua',
      industry_supervisor_email: 'd.mutua@cybersecurity.africa',
      start_date: '2024-01-15',
      end_date: '2024-04-12',
      status: 'active'
    }
  ]);
};
