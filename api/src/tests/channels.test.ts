import request from 'supertest';
import app from '../app';
import { clearDatabase, createTestServer, createTestChannel } from './helpers';
import { Channel } from '../types';

describe('Channel Routes', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    describe('GET /api/channels', () => {
        it('return an empty array when no channels exist', async () => {
            const response = await request(app).get('/api/channels');
            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        it('return all channels (nonempty)', async () => {
            const server = await createTestServer();
            const channel = await createTestChannel({ server_id: server.id });
            const response = await request(app).get('/api/channels');
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].name).toBe(channel.name);
        });
    });

    describe('GET /api/channels/server/:serverId', () => {
        it('return channels for a specific server', async () => {
            const server = await createTestServer();
            const channel = await createTestChannel({ server_id: server.id });
            const response = await request(app).get(`/api/channels/server/${server.id}`);
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].name).toBe(channel.name);
        });

        it('return an empty array for a server without channels', async () => {
            const server = await createTestServer();
            const response = await request(app).get(`/api/channels/server/${server.id}`);
            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });
    });

    describe('POST /api/channels', () => {
        it('create a new channel', async () => {
            const server = await createTestServer();
            const channelData = {
                name: 'test-channel',
                server_id: server.id
            };

            const response = await request(app)
                .post('/api/channels')
                .send(channelData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe(channelData.name);
            expect(response.body.server_id).toBe(channelData.server_id);
        });

        it('fail with non existant server', async () => {
            const response = await request(app)
                .post('/api/channels')
                .send({
                    name: 'test-channel',
                    server_id: '00000000-0000-0000-0000-000000000000'
                });

            expect(response.status).toBe(500);
        });
    });

    describe('PUT /api/channels/:id', () => {
        it('update channel name', async () => {
            const server = await createTestServer();
            const channel = await createTestChannel({ server_id: server.id });
            const updateData = {
                name: 'updated-channel'
            };

            const response = await request(app)
                .put(`/api/channels/${channel.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(updateData.name);
        });

        it('should return 404 for non-existent channel', async () => {
            const response = await request(app)
                .put('/api/channels/00000000-0000-0000-0000-000000000000')
                .send({ name: 'test' });
            expect(response.status).toBe(404);
        });
    });

    describe('DELETE /api/channels/:id', () => {
        it('delete channel', async () => {
            const server = await createTestServer();
            const channel = await createTestChannel({ server_id: server.id });
            const response = await request(app).delete(`/api/channels/${channel.id}`);
            expect(response.status).toBe(200);

            const getResponse = await request(app).get(`/api/channels/${channel.id}`);
            expect(getResponse.status).toBe(404);
        });

        it('return 404 for non existant channel', async () => {
            const response = await request(app)
                .delete('/api/channels/00000000-0000-0000-0000-000000000000');
            expect(response.status).toBe(404);
        });
    });
});
