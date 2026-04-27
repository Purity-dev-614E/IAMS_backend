/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('attachments', function(table) {
    table.increments('id').primary();
    table.integer('student_id').unsigned().notNullable();
    table.string('organization_name').notNullable();
    table.string('industry_supervisor_name').notNullable();
    table.string('industry_supervisor_email').notNullable();
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.enum('status', ['pending', 'active', 'completed']).defaultTo('pending');
    table.timestamps(true, true);
    
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.index('student_id');
    table.index('status');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('attachments');
};
