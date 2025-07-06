import request from 'supertest';
import app from '../app';
import { clearDatabase, createTestServer, createTestUser } from './helpers';
import { Server } from '../types';

describe('Server Routes', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    describe('POST /api/servers', () => {
        it('should create a new server', async () => {
            const user = await createTestUser();
            const serverData = {
                name: 'Test Server',
                ip: '192.168.1.100',
                port: 8080,
                users: [user.id],
                channels: []
            };

            const response = await request(app)
                .post('/api/servers')
                .send(serverData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe(serverData.name);
            expect(response.body.ip).toBe(serverData.ip);
            expect(response.body.port).toBe(serverData.port);
            expect(response.body.users).toEqual(serverData.users);
        });

        it('should fail with invalid port', async () => {
            const response = await request(app)
                .post('/api/servers')
                .send({
                    name: 'Test Server',
                    ip: '192.168.1.100',
                    port: 0,
                    users: [],
                    channels: []
                });

            expect(response.status).toBe(500);
        });
    });

    describe('GET /api/servers/:id', () => {
        it('should return server by id', async () => {
            const server = await createTestServer();
            console.log("Test server is: ", server);
            console.log(`Server id is ${server.id}`);
            const response = await request(app).get(`/api/servers/${server.id}`);
            expect(response.status).toBe(200);
            expect(response.body.id).toBe(server.id);
        });

        it('should return 404 for non-existent server', async () => {
            const response = await request(app)
                .get('/api/servers/00000000-0000-0000-0000-000000000000');
            expect(response.status).toBe(404);
        });
    });

    describe('PUT /api/servers/:id', () => {
        it('should update server', async () => {
            const server = await createTestServer();
            const updateData = {
                name: 'Updated Server',
                ip: '192.168.1.200',
                port: 8081,
                users: [],
                channels: []
            };

            const response = await request(app)
                .put(`/api/servers/${server.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(updateData.name);
            expect(response.body.ip).toBe(updateData.ip);
            expect(response.body.port).toBe(updateData.port);
        });

        it('should return 404 for non-existent server', async () => {
            const response = await request(app)
                .put('/api/servers/00000000-0000-0000-0000-000000000000')
                .send({ name: 'test' });
            expect(response.status).toBe(404);
        });
    });

    describe('DELETE /api/servers/:id', () => {
        it('should delete server', async () => {
            const server = await createTestServer();
            const response = await request(app).delete(`/api/servers/${server.id}`);
            expect(response.status).toBe(200);

            const getResponse = await request(app).get(`/api/servers/${server.id}`);
            expect(getResponse.status).toBe(404);
        });

        it('should return 404 for non-existent server', async () => {
            const response = await request(app)
                .delete('/api/servers/00000000-0000-0000-0000-000000000000');
            expect(response.status).toBe(404);
        });
    });
});
