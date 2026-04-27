/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('weekly_reviews', function(table) {
    table.increments('id').primary();
    table.integer('attachment_id').unsigned().notNullable();
    table.integer('week_number').notNullable();
    table.date('week_start_date').notNullable();
    table.date('week_end_date').notNullable();
    table.enum('status', ['pending', 'industry_reviewed', 'uni_reviewed', 'complete']).defaultTo('pending');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.foreign('attachment_id').references('id').inTable('attachments').onDelete('CASCADE');
    table.unique(['attachment_id', 'week_number']);
    table.index('attachment_id');
    table.index('week_start_date');
    table.index('status');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('weekly_reviews');
};
