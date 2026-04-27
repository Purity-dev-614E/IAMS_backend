const { v4: uuidv4 } = require('uuid');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('attachments').del();
  
  // Generate UUIDs for attachments
  const attachment1Id = uuidv4();
  const attachment2Id = uuidv4();
  const attachment3Id = uuidv4();
  
  // Insert seed entries using UUIDs from students seed
  await knex('attachments').insert([
    {
      id: attachment1Id,
      student_id: global.seedUUIDs.student1Profile, // Alice Kimani
      organization_name: 'Tech Solutions Kenya',
      industry_supervisor_name: 'James Mwangi',
      industry_supervisor_email: 'j.mwangi@techsolutions.co.ke',
      start_date: '2024-01-08',
      end_date: '2024-04-05',
      status: 'active'
    },
    {
      id: attachment2Id,
      student_id: global.seedUUIDs.student2Profile, // Bob Ochieng
      organization_name: 'Digital Innovations Ltd',
      industry_supervisor_name: 'Grace Njoroge',
      industry_supervisor_email: 'g.njoroge@digitalinnovations.com',
      start_date: '2024-01-08',
      end_date: '2024-04-05',
      status: 'active'
    },
    {
      id: attachment3Id,
      student_id: global.seedUUIDs.student3Profile, // Carol Wanjiku
      organization_name: 'Cyber Security Africa',
      industry_supervisor_name: 'David Mutua',
      industry_supervisor_email: 'd.mutua@cybersecurity.africa',
      start_date: '2024-01-15',
      end_date: '2024-04-12',
      status: 'active'
    }
  ]);
  
  // Store attachment UUIDs for use in other seed files
  global.seedUUIDs.attachment1 = attachment1Id;
  global.seedUUIDs.attachment2 = attachment2Id;
  global.seedUUIDs.attachment3 = attachment3Id;
};
