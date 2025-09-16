import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('trips', (table) => {
    table.string('trip_id').primary();
    table.string('user_id').notNullable();
    table.integer('trip_number').notNullable();
    table.string('chain_id').notNullable();
    
    // Origin
    table.decimal('origin_lat', 10, 8).notNullable();
    table.decimal('origin_lon', 11, 8).notNullable();
    table.string('origin_place_name').notNullable();
    
    // Destination
    table.decimal('destination_lat', 10, 8).notNullable();
    table.decimal('destination_lon', 11, 8).notNullable();
    table.string('destination_place_name').notNullable();
    
    // Trip details
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').notNullable();
    table.integer('duration_seconds').notNullable();
    table.decimal('distance_meters', 10, 2).notNullable();
    
    // Travel mode
    table.string('travel_mode_detected').notNullable();
    table.string('travel_mode_confirmed');
    table.decimal('travel_mode_confidence', 3, 2).notNullable();
    
    // Trip purpose and accompanying
    table.string('trip_purpose').notNullable();
    table.integer('num_accompanying').notNullable().defaultTo(0);
    table.text('accompanying_basic');
    table.text('notes');
    
    // Sensor data
    table.text('sensor_summary').notNullable();
    table.decimal('plausibility_score', 3, 2);
    
    // Status flags
    table.boolean('recorded_offline').defaultTo(true);
    table.boolean('synced').defaultTo(false);
    table.boolean('is_private').defaultTo(false);
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['user_id']);
    table.index(['chain_id']);
    table.index(['start_time']);
    table.index(['synced']);
    table.index(['is_private']);
    table.index(['travel_mode_detected']);
    table.index(['trip_purpose']);
    
    // Foreign key
    table.foreign('user_id').references('user_id').inTable('users').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('trips');
}
