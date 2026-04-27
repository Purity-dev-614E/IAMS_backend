const crypto = require('crypto');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('industry_feedback').del();
  await knex('uni_feedback').del();
  
  // Generate verification tokens
  const generateToken = () => crypto.randomBytes(32).toString('hex');
  
  // Insert industry feedback
  await knex('industry_feedback').insert([
    {
      id: 1,
      weekly_review_id: 1, // Alice Week 1 (complete)
      verification_token: generateToken(),
      comments: 'Alice has shown excellent progress in web development. Her JavaScript skills have improved significantly.',
      improvements: 'Could benefit from more advanced CSS and responsive design practice.',
      approval: 'approved',
      submitted_at: new Date('2024-01-15').toISOString()
    },
    {
      id: 2,
      weekly_review_id: 2, // Alice Week 2 (uni_reviewed)
      verification_token: generateToken(),
      comments: 'Good work on React components. Shows strong problem-solving abilities.',
      improvements: 'Focus on state management patterns and testing methodologies.',
      approval: 'approved',
      submitted_at: new Date('2024-01-22').toISOString()
    },
    {
      id: 3,
      weekly_review_id: 3, // Bob Week 1 (industry_reviewed)
      verification_token: generateToken(),
      comments: 'Bob demonstrates strong database design skills. His SQL queries are well-optimized.',
      improvements: 'Should work more on API documentation and error handling.',
      approval: 'approved',
      submitted_at: new Date('2024-01-15').toISOString()
    }
  ]);
  
  // Insert university feedback
  await knex('uni_feedback').insert([
    {
      id: 1,
      weekly_review_id: 1, // Alice Week 1
      uni_supervisor_id: 2, // Dr. Sarah Johnson
      comments: 'Excellent progress. Alice is meeting all academic requirements for her industrial attachment.',
      improvements: 'Continue focusing on industry best practices and professional development.',
      rating: 85,
      created_at: new Date('2024-01-16').toISOString(),
      updated_at: new Date('2024-01-16').toISOString()
    },
    {
      id: 2,
      weekly_review_id: 2, // Alice Week 2
      uni_supervisor_id: 2, // Dr. Sarah Johnson
      comments: 'Consistent performance. Alice is developing strong technical competencies.',
      improvements: 'Consider exploring advanced JavaScript frameworks and cloud technologies.',
      rating: 88,
      created_at: new Date('2024-01-23').toISOString(),
      updated_at: new Date('2024-01-23').toISOString()
    }
  ]);
};
