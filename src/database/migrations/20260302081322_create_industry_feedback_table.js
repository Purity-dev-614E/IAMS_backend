/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('industry_feedback', function(table) {
    table.increments('id').primary();
    table.integer('weekly_review_id').unsigned().notNullable();
    table.string('verification_token').notNullable().unique();
    table.text('comments').nullable();
    table.text('improvements').nullable();
    table.enum('approval', ['approved', 'rejected']).nullable();
    table.timestamp('submitted_at').nullable();
    table.timestamps(true, true);
    
    table.foreign('weekly_review_id').references('id').inTable('weekly_reviews').onDelete('CASCADE');
    table.index('weekly_review_id');
    table.index('verification_token');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('industry_feedback');
};
