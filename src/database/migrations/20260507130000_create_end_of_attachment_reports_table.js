/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('end_of_attachment_reports', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('attachment_id').notNullable();
    table.uuid('student_id').notNullable();
    table.enum('submission_type', ['pdf', 'text']).notNullable();
    table.text('text_content').nullable();
    table.string('pdf_file_path').nullable();
    table.string('pdf_filename').nullable();
    table.enum('status', ['submitted', 'under_review', 'approved', 'rejected']).defaultTo('submitted');
    table.text('feedback_comments').nullable();
    table.uuid('reviewed_by').nullable();
    table.timestamp('reviewed_at').nullable();
    table.timestamp('submitted_at').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.foreign('attachment_id').references('id').inTable('attachments').onDelete('CASCADE');
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('reviewed_by').references('id').inTable('users').onDelete('SET NULL');
    table.index('attachment_id');
    table.index('student_id');
    table.index('status');
    table.index('submission_type');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('end_of_attachment_reports');
};
