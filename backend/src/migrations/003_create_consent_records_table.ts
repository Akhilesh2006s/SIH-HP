import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('consent_records', (table) => {
    table.string('user_id').notNullable();
    table.string('consent_version').notNullable();
    table.boolean('background_tracking_consent').notNullable();
    table.boolean('data_sharing_consent').notNullable();
    table.boolean('analytics_consent').notNullable();
    table.timestamp('consent_timestamp').notNullable();
    table.string('ip_address');
    table.text('user_agent');
    
    // Composite primary key
    table.primary(['user_id', 'consent_version']);
    
    // Indexes
    table.index(['user_id']);
    table.index(['consent_version']);
    table.index(['consent_timestamp']);
    
    // Foreign key
    table.foreign('user_id').references('user_id').inTable('users').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('consent_records');
}
