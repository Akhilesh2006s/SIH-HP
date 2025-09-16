import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create anonymization jobs table
  await knex.schema.createTable('anonymization_jobs', (table) => {
    table.string('job_id').primary();
    table.string('status').notNullable(); // queued, processing, completed, failed
    table.string('start_date').notNullable();
    table.string('end_date').notNullable();
    table.string('anonymization_level').notNullable();
    table.text('aggregation_zones').notNullable(); // JSON
    table.integer('time_bin_size').notNullable();
    table.integer('records_processed').defaultTo(0);
    table.text('error_message');
    table.timestamp('estimated_completion');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['status']);
    table.index(['created_at']);
  });

  // Create data exports table
  await knex.schema.createTable('data_exports', (table) => {
    table.string('export_id').primary();
    table.string('start_date').notNullable();
    table.string('end_date').notNullable();
    table.string('format').notNullable();
    table.text('data_types').notNullable(); // JSON array
    table.string('status').notNullable(); // processing, completed, failed
    table.string('download_url');
    table.integer('file_size');
    table.text('error_message');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['status']);
    table.index(['created_at']);
  });

  // Create user data exports table
  await knex.schema.createTable('user_data_exports', (table) => {
    table.string('export_id').primary();
    table.string('user_id').notNullable();
    table.string('file_name').notNullable();
    table.string('file_path').notNullable();
    table.integer('file_size').notNullable();
    table.string('format').notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['user_id']);
    table.index(['expires_at']);
    
    // Foreign key
    table.foreign('user_id').references('user_id').inTable('users').onDelete('CASCADE');
  });

  // Create data deletions audit table
  await knex.schema.createTable('data_deletions', (table) => {
    table.increments('id').primary();
    table.string('user_id').notNullable();
    table.boolean('delete_all').notNullable();
    table.text('date_range'); // JSON
    table.integer('deleted_trip_count').notNullable();
    table.text('deleted_trip_ids').notNullable(); // JSON array
    table.string('ip_address');
    table.text('user_agent');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['user_id']);
    table.index(['created_at']);
    
    // Foreign key
    table.foreign('user_id').references('user_id').inTable('users').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('data_deletions');
  await knex.schema.dropTable('user_data_exports');
  await knex.schema.dropTable('data_exports');
  await knex.schema.dropTable('anonymization_jobs');
}
