import bcrypt from 'bcrypt';
import { Pool, PoolClient } from 'pg';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';

// Initialize the PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Connection error:', err);
  } else {
    console.log('Connection successful:', res?.rows);
  }
});

async function seedUsers(client: PoolClient): Promise<void> {
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await client.query(
      `
      INSERT INTO users (id, name, email, password)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING;
      `,
      [user.id, user.name, user.email, hashedPassword]
    );
  }
}

async function seedInvoices(client: PoolClient): Promise<void> {
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      customer_id UUID NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL
    );
  `);

  for (const invoice of invoices) {
    await client.query(
      `
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING;
      `,
      [invoice.customer_id, invoice.amount, invoice.status, invoice.date]
    );
  }
}

async function seedCustomers(client: PoolClient): Promise<void> {
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      image_url VARCHAR(255) NOT NULL
    );
  `);

  for (const customer of customers) {
    await client.query(
      `
      INSERT INTO customers (id, name, email, image_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING;
      `,
      [customer.id, customer.name, customer.email, customer.image_url]
    );
  }
}

async function seedRevenue(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) NOT NULL UNIQUE,
      revenue INT NOT NULL
    );
  `);

  for (const rev of revenue) {
    await client.query(
      `
      INSERT INTO revenue (month, revenue)
      VALUES ($1, $2)
      ON CONFLICT (month) DO NOTHING;
      `,
      [rev.month, rev.revenue]
    );
  }
}

export async function GET(): Promise<Response> {
  const client = await pool.connect();
  try {
    await client.query(`BEGIN`);
    await seedUsers(client);
    await seedCustomers(client);
    await seedInvoices(client);
    await seedRevenue(client);
    await client.query(`COMMIT`);

    return new Response(
      JSON.stringify({ message: 'Database seeded successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    await client.query(`ROLLBACK`);
    console.error('Error seeding database:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    client.release();
  }
}
