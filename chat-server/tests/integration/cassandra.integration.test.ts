import { connectToCassandra, disconnectFromCassandra, getCassandraClient } from '@/database/cassandra';
import { MessageService } from '@/services/messageService';

// Note: This test relies on credentials/credentials.toml file having:
// [cassandra]
// host="localhost"
// port=9042

describe('Cassandra Database Integration', () => {
    beforeAll(async () => {
        // Connect to Cassandra before running tests
        await connectToCassandra();
    }, 10000); // Increase timeout to 10 seconds

    afterAll(async () => {
        // Clean up and disconnect after tests
        await disconnectFromCassandra();
    });

    describe('Database Connection', () => {
        test('should connect to Cassandra successfully', async () => {
            const client = getCassandraClient();
            expect(client).toBeDefined();

            // Test connection with a simple query
            const result = await client.execute('SELECT now() FROM system.local');
            expect(result.rows).toBeDefined();
            expect(result.rows.length).toBeGreaterThan(0);
        });

        test('should have created the chime keyspace', async () => {
            const client = getCassandraClient();
            const result = await client.execute('SELECT keyspace_name FROM system_schema.keyspaces WHERE keyspace_name = \'chime\'');

            expect(result.rows).toBeDefined();
            expect(result.rows.length).toBe(1);
            expect(result.rows[0].keyspace_name).toBe('chime');
        });

        test('should have created the messages table', async () => {
            const client = getCassandraClient();
            const result = await client.execute('SELECT table_name FROM system_schema.tables WHERE keyspace_name = \'chime\' AND table_name = \'messages\'');

            expect(result.rows).toBeDefined();
            expect(result.rows.length).toBe(1);
            expect(result.rows[0].table_name).toBe('messages');
        });
    });

    describe('MessageService Integration', () => {
        let messageService: MessageService;
        const testChannelId = `test-channel-${Date.now()}`;
        const testUserId = 'test-user-123';

        beforeEach(async () => {
            messageService = new MessageService(true); // Use test Redis instance
            await messageService.connect(); // Connect the MessageService (which connects MessageIDService)
        });

        afterEach(async () => {
            // Disconnect MessageService
            await messageService.disconnect();
            
            // Clean up test data
            const client = getCassandraClient();
            await client.execute('DELETE FROM messages WHERE channel_id = ?', [testChannelId]);
            await client.execute('DELETE FROM message_counters WHERE channel_id = ?', [testChannelId]);
        });

        test('should save a message', async () => {
            const content = 'Test message content';

            // Let the real getNextMessageId run
            const savedMessage = await messageService.saveMessage(testChannelId, testUserId, content);

            expect(savedMessage).toBeDefined();
            expect(savedMessage.channelId).toBe(testChannelId);
            expect(savedMessage.userId).toBe(testUserId);
            expect(savedMessage.content).toBe(content);
            expect(savedMessage.messageId).toBe(savedMessage.messageId);
            expect(savedMessage.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO string format
            expect(savedMessage.editedAt).toBeNull();
            expect(savedMessage.metadata).toEqual({});

            // Also verify it was written to the database
            const client = getCassandraClient();
            const result = await client.execute('SELECT * FROM messages WHERE channel_id = ? AND message_id = ?', [testChannelId, savedMessage.messageId], { prepare: true });
            expect(result.rows.length).toBe(1);
            expect(result.rows[0].content).toBe(content);
        });
    });
});
