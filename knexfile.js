require('dotenv').config();

module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_I0EfYOwHTys6@ep-weathered-snow-ai1nr05y-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: './src/database/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './src/database/seeds'
    }
  },
  
  production: {
    client: 'postgresql',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: './src/database/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './src/database/seeds'
    }
  }
};
