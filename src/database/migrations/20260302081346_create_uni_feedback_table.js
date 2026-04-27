/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('uni_feedback', function(table) {
    table.increments('id').primary();
    table.integer('weekly_review_id').unsigned().notNullable();
    table.integer('uni_supervisor_id').unsigned().notNullable();
    table.text('comments').nullable();
    table.text('improvements').nullable();
    table.integer('rating').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.foreign('weekly_review_id').references('id').inTable('weekly_reviews').onDelete('CASCADE');
    table.foreign('uni_supervisor_id').references('id').inTable('users').onDelete('CASCADE');
    table.index('weekly_review_id');
    table.index('uni_supervisor_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('uni_feedback');
};
