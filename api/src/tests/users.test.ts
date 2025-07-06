import request from 'supertest';
import app from '../app';
import { clearDatabase, createTestUser } from './helpers';
import { User } from '../types';

describe('User Routes', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    describe('GET /api/users', () => {
        it('should return empty array when no users exist', async () => {
            const response = await request(app).get('/api/users');

            expect(response).toHaveStatusCode(200);
            expect(response.body).toEqual([]);
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should return all users', async () => {
            const user = await createTestUser();
            const response = await request(app).get('/api/users');

            expect(response).toHaveStatusCode(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0]).toHaveValidId();
            expect(response.body[0].username).toBe(user.username);
            expect(response.body[0]).toMatchUser({
                username: user.username,
                display_name: user.display_name,
                avatar_url: user.avatar_url
            });
        });
    });

    describe('POST /api/users', () => {
        it('should create a new user', async () => {
            const userData = {
                username: 'test',
                display_name: 'test123',
                avatar_url: 'https://example.com/avatar.jpg'
            };

            const response = await request(app)
                .post('/api/users')
                .send(userData);

            expect(response).toHaveStatusCode(201);
            expect(response.body).toHaveValidId();
            expect(response.body).toMatchUser(userData);
        });

        it('should fail when username is already taken', async () => {
            // First create a user
            await createTestUser({ username: 'test' });

            // Try to create another user with the same username
            const userData = {
                username: 'test',
                display_name: 'test456',
                avatar_url: 'https://example.com/avatar.jpg'
            };

            const response = await request(app)
                .post('/api/users')
                .send(userData);

            expect(response).toHaveStatusCode(500);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Username already exists');
        });
    });

    describe('GET /api/users/:id', () => {
        it('should return user by id', async () => {
            const user = await createTestUser();
            const response = await request(app).get(`/api/users/${user.id}`);

            expect(response).toHaveStatusCode(200);
            expect(response.body).toHaveValidId();
            expect(response.body.username).toBe(user.username);
        });

        it('should return 404 for non-existent user', async () => {
            const nonExistentId = '00000000-0000-0000-0000-000000000000';
            const response = await request(app).get(`/api/users/${nonExistentId}`);

            expect(response).toHaveStatusCode(404);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toBe('User not found');
        });
    });

    describe('PUT /api/users/:id', () => {
        it('should update user', async () => {
            const user = await createTestUser();
            const updateData = {
                username: 'updateduser',
                display_name: 'Updated User',
                avatar_url: 'https://example.com/new-avatar.jpg'
            };

            const response = await request(app)
                .put(`/api/users/${user.id}`)
                .send(updateData);

            expect(response).toHaveStatusCode(200);
            expect(response.body).toHaveValidId();
            expect(response.body).toMatchUser(updateData);
        });

        it('should return 404 for non-existent user', async () => {
            const nonExistentId = '00000000-0000-0000-0000-000000000000';
            const response = await request(app)
                .put(`/api/users/${nonExistentId}`)
                .send({ username: 'test' });

            expect(response).toHaveStatusCode(404);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toBe('User not found');
        });
    });

    describe('DELETE /api/users/:id', () => {
        it('should delete user', async () => {
            const user = await createTestUser();
            const response = await request(app).delete(`/api/users/${user.id}`);

            expect(response).toHaveStatusCode(200);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe('User deleted successfully');

            // Verify user is actually deleted
            const getResponse = await request(app).get(`/api/users/${user.id}`);
            expect(getResponse).toHaveStatusCode(404);
        });

        it('should return 404 for non-existent user', async () => {
            const nonExistentId = '00000000-0000-0000-0000-000000000000';
            const response = await request(app).delete(`/api/users/${nonExistentId}`);

            expect(response).toHaveStatusCode(404);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toBe('User not found');
        });
    });
});
