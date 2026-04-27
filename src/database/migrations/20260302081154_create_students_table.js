/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('students', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('reg_number').notNullable().unique();
    table.string('program').notNullable();
    table.integer('year_of_study').notNullable();
    table.integer('uni_supervisor_id').unsigned().nullable();
    table.timestamps(true, true);
    
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('uni_supervisor_id').references('id').inTable('users').onDelete('SET NULL');
    table.index('reg_number');
    table.index('uni_supervisor_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('students');
};
