/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('reports', function(table) {
    table.increments('id').primary();
    table.integer('generated_by').unsigned().notNullable();
    table.string('type').notNullable();
    table.json('parameters').nullable();
    table.string('file_path').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.foreign('generated_by').references('id').inTable('users').onDelete('CASCADE');
    table.index('generated_by');
    table.index('type');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('reports');
};
