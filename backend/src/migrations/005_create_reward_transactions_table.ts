import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('reward_transactions', (table) => {
    table.string('transaction_id').primary();
    table.string('user_id').notNullable();
    table.string('trip_id');
    table.integer('points_earned').notNullable().defaultTo(0);
    table.integer('points_redeemed').notNullable().defaultTo(0);
    table.string('transaction_type').notNullable();
    table.text('description').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['user_id']);
    table.index(['trip_id']);
    table.index(['transaction_type']);
    table.index(['created_at']);
    
    // Foreign keys
    table.foreign('user_id').references('user_id').inTable('users').onDelete('CASCADE');
    table.foreign('trip_id').references('trip_id').inTable('trips').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('reward_transactions');
}
