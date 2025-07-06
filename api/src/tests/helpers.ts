import { User, Server, Channel } from '../types';
import pool from '../config/database';

// Close pool after tests
afterAll(async () => {
    await pool.end();
});

export const clearDatabase = async () => {
    // Clear in correct order due to foreign key constraints
    await pool.query('DELETE FROM channels');
    await pool.query('DELETE FROM servers');
    await pool.query('DELETE FROM users');
};

export const createTestUser = async (data: Partial<User> = {}): Promise<User> => {
    const result = await pool.query<User>(
        'INSERT INTO users (username, display_name, avatar_url) VALUES ($1, $2, $3) RETURNING *',
        [
            data.username || 'test',
            data.display_name || 'Test User',
            data.avatar_url || 'https://example.com/avatar.jpg'
        ]
    );
    return result.rows[0];
};

export const createTestServer = async (data: Partial<Server> = {}): Promise<Server> => {
    const result = await pool.query<Server>(
        'INSERT INTO servers (name, ip, port, users, channels) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [
            data.name || 'Test Server',
            data.ip || '127.0.0.1',
            data.port || 8080,
            data.users || [],
            data.channels || []
        ]
    );
    return result.rows[0];
};

export const createTestChannel = async (data: Partial<Channel> & { server_id: string }): Promise<Channel> => {
    const result = await pool.query<Channel>(
        'INSERT INTO channels (name, server_id) VALUES ($1, $2) RETURNING *',
        [data.name || 'test-channel', data.server_id]
    );
    return result.rows[0];
};
