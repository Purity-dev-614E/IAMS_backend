/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('students', function(table) {
    table.string('school').nullable();
    table.integer('admission_year').nullable();
    table.enum('academic_status', ['active', 'deferred', 'suspended', 'completed', 'graduated', 'inactive'])
      .notNullable()
      .defaultTo('active');

    table.index('school');
    table.index('academic_status');
    table.index('admission_year');
  });

  await knex.schema.createTable('attachment_eligibility_reviews', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('student_id').notNullable();
    table.enum('status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending');
    table.enum('reason_type', ['deferred', 'repeating', 'transfer', 'readmission', 'special_approval', 'other'])
      .notNullable()
      .defaultTo('other');
    table.text('explanation').notNullable();
    table.text('admin_comment').nullable();
    table.uuid('reviewed_by').nullable();
    table.timestamp('reviewed_at').nullable();
    table.date('expires_at').nullable();
    table.timestamps(true, true);

    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('reviewed_by').references('id').inTable('users').onDelete('SET NULL');
    table.index('student_id');
    table.index('status');
    table.index('reason_type');
    table.index('expires_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('attachment_eligibility_reviews');

  await knex.schema.alterTable('students', function(table) {
    table.dropIndex(['school']);
    table.dropIndex(['academic_status']);
    table.dropIndex(['admission_year']);
    table.dropColumn('school');
    table.dropColumn('admission_year');
    table.dropColumn('academic_status');
  });
};
