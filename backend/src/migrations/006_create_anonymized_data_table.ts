import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('anonymized_trips', (table) => {
    table.string('trip_id').primary();
    table.string('zone_origin').notNullable();
    table.string('zone_destination').notNullable();
    table.string('start_time_bin').notNullable();
    table.string('end_time_bin').notNullable();
    table.integer('duration_seconds').notNullable();
    table.decimal('distance_meters', 10, 2).notNullable();
    table.string('travel_mode').notNullable();
    table.string('trip_purpose').notNullable();
    table.integer('num_accompanying').notNullable();
    table.text('sensor_summary').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['zone_origin']);
    table.index(['zone_destination']);
    table.index(['start_time_bin']);
    table.index(['travel_mode']);
    table.index(['trip_purpose']);
    table.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('anonymized_trips');
}
