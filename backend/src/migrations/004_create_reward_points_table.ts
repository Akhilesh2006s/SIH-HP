import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('reward_points', (table) => {
    table.string('user_id').primary();
    table.integer('total_points').notNullable().defaultTo(0);
    table.integer('available_points').notNullable().defaultTo(0);
    table.integer('redeemed_points').notNullable().defaultTo(0);
    table.timestamp('last_earned');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['total_points']);
    table.index(['available_points']);
    table.index(['last_earned']);
    
    // Foreign key
    table.foreign('user_id').references('user_id').inTable('users').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('reward_points');
}
