/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('daily_logs', function(table) {
    table.increments('id').primary();
    table.integer('attachment_id').unsigned().notNullable();
    table.date('log_date').notNullable();
    table.text('tasks_performed').notNullable();
    table.text('skills_acquired').notNullable();
    table.text('observations').notNullable();
    table.enum('status', ['draft', 'submitted']).defaultTo('draft');
    table.timestamp('submitted_at').nullable();
    table.timestamps(true, true);
    
    table.foreign('attachment_id').references('id').inTable('attachments').onDelete('CASCADE');
    table.index('attachment_id');
    table.index('log_date');
    table.index('status');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('daily_logs');
};
