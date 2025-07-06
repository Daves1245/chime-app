import dotenv from 'dotenv';

// Load test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'chime_test';
process.env.DB_USER = 'postgres';
process.env.DB_HOST = 'localhost';
process.env.DB_PASSWORD = 'postgres';
process.env.DB_PORT = '5432';
