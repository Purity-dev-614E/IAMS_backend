/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('industry_feedback', function(table) {
    table.text('comments').alter();
    table.text('improvements').alter();
    table.timestamp('submitted_at').alter();
  }).then(() => {
    // Handle enum column separately using raw SQL
    return knex.raw(`
      ALTER TABLE industry_feedback 
      ALTER COLUMN approval DROP NOT NULL
    `);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('industry_feedback', function(table) {
    table.text('comments').alter();
    table.text('improvements').alter();
    table.timestamp('submitted_at').alter();
  }).then(() => {
    // Handle enum column separately using raw SQL
    return knex.raw(`
      ALTER TABLE industry_feedback 
      ALTER COLUMN approval SET NOT NULL
    `);
  });
};
