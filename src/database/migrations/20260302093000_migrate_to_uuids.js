/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  // Enable UUID extension for PostgreSQL
  return knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    .then(() => {
      // Drop all existing tables in reverse order of dependencies
      return knex.schema.dropTableIfExists('reports')
        .then(() => knex.schema.dropTableIfExists('uni_feedback'))
        .then(() => knex.schema.dropTableIfExists('industry_feedback'))
        .then(() => knex.schema.dropTableIfExists('weekly_reviews'))
        .then(() => knex.schema.dropTableIfExists('daily_logs'))
        .then(() => knex.schema.dropTableIfExists('attachments'))
        .then(() => knex.schema.dropTableIfExists('students'))
        .then(() => knex.schema.dropTableIfExists('users'));
    })
    .then(() => {
      // Recreate users table with UUID primary key
      return knex.schema.createTable('users', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('name').notNullable();
        table.string('email').notNullable().unique();
        table.string('password_hash').notNullable();
        table.enum('role', ['student', 'uni_supervisor', 'admin']).notNullable();
        table.timestamps(true, true);
        
        table.index('email');
        table.index('role');
      });
    })
    .then(() => {
      // Recreate students table with UUID foreign keys
      return knex.schema.createTable('students', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('user_id').notNullable();
        table.string('reg_number').notNullable().unique();
        table.string('program').notNullable();
        table.integer('year_of_study').notNullable();
        table.uuid('uni_supervisor_id').nullable();
        table.timestamps(true, true);
        
        table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
        table.foreign('uni_supervisor_id').references('id').inTable('users').onDelete('SET NULL');
        table.index('reg_number');
        table.index('uni_supervisor_id');
      });
    })
    .then(() => {
      // Recreate attachments table with UUID foreign keys
      return knex.schema.createTable('attachments', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('student_id').notNullable();
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
    })
    .then(() => {
      // Recreate daily_logs table with UUID foreign keys
      return knex.schema.createTable('daily_logs', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('attachment_id').notNullable();
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
    })
    .then(() => {
      // Recreate weekly_reviews table with UUID foreign keys
      return knex.schema.createTable('weekly_reviews', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('attachment_id').notNullable();
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
    })
    .then(() => {
      // Recreate industry_feedback table with UUID foreign keys
      return knex.schema.createTable('industry_feedback', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('weekly_review_id').notNullable();
        table.string('verification_token').notNullable().unique();
        table.text('comments').nullable();
        table.text('improvements').nullable();
        table.enum('approval', ['approved', 'rejected']).notNullable();
        table.timestamp('submitted_at').defaultTo(knex.fn.now());
        table.timestamps(true, true);
        
        table.foreign('weekly_review_id').references('id').inTable('weekly_reviews').onDelete('CASCADE');
        table.index('verification_token');
        table.index('weekly_review_id');
      });
    })
    .then(() => {
      // Recreate uni_feedback table with UUID foreign keys
      return knex.schema.createTable('uni_feedback', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('weekly_review_id').notNullable();
        table.uuid('uni_supervisor_id').notNullable();
        table.text('comments').nullable();
        table.text('improvements').nullable();
        table.integer('rating').notNullable();
        table.timestamp('submitted_at').defaultTo(knex.fn.now());
        table.timestamps(true, true);
        
        table.foreign('weekly_review_id').references('id').inTable('weekly_reviews').onDelete('CASCADE');
        table.foreign('uni_supervisor_id').references('id').inTable('users').onDelete('CASCADE');
        table.index('weekly_review_id');
        table.index('uni_supervisor_id');
      });
    })
    .then(() => {
      // Recreate reports table with UUID foreign keys
      return knex.schema.createTable('reports', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('student_id').notNullable();
        table.string('report_type').notNullable();
        table.text('content').notNullable();
        table.enum('status', ['draft', 'submitted', 'reviewed']).defaultTo('draft');
        table.timestamp('submitted_at').nullable();
        table.timestamps(true, true);
        
        table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
        table.index('student_id');
        table.index('report_type');
        table.index('status');
      });
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // Drop all tables in reverse order of dependencies
  return knex.schema.dropTableIfExists('reports')
    .then(() => knex.schema.dropTableIfExists('uni_feedback'))
    .then(() => knex.schema.dropTableIfExists('industry_feedback'))
    .then(() => knex.schema.dropTableIfExists('weekly_reviews'))
    .then(() => knex.schema.dropTableIfExists('daily_logs'))
    .then(() => knex.schema.dropTableIfExists('attachments'))
    .then(() => knex.schema.dropTableIfExists('students'))
    .then(() => knex.schema.dropTableIfExists('users'))
    .then(() => {
      // Disable UUID extension
      return knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
    });
};
