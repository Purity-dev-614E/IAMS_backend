/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.raw(`
    ALTER TABLE attachments
    DROP CONSTRAINT IF EXISTS attachments_status_check
  `);

  await knex.raw(`
    ALTER TABLE attachments
    ADD CONSTRAINT attachments_status_check
    CHECK (status IN ('pending', 'active', 'completed', 'inactive'))
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex('attachments')
    .where('status', 'inactive')
    .update({ status: 'completed' });

  await knex.raw(`
    ALTER TABLE attachments
    DROP CONSTRAINT IF EXISTS attachments_status_check
  `);

  await knex.raw(`
    ALTER TABLE attachments
    ADD CONSTRAINT attachments_status_check
    CHECK (status IN ('pending', 'active', 'completed'))
  `);
};
