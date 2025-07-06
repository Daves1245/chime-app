// Mock the cassandra-driver before importing anything
const mockClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue({ rows: [] })
};

const mockClientConstructor = jest.fn().mockImplementation(() => mockClient);

jest.mock('cassandra-driver', () => ({
    Client: mockClientConstructor
}));

jest.mock('@/logger', () => ({
    __esModule: true,
    default: {
        child: jest.fn().mockReturnThis(),
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Mock credentials instead of env variables
jest.mock('@/util/Credentials', () => ({
    loadCredentials: jest.fn().mockReturnValue({
        api: { host: 'localhost', port: '3145' },
        redis: { host: 'localhost', port: '6379', username: 'default', password: 'test-password' },
        cassandra: { host: 'localhost', port: '9042' }
    })
}));

// Import after mocking
import { getCassandraClient, connectToCassandra, disconnectFromCassandra } from '@/database/cassandra';
import logger from '@/logger';

describe('Cassandra Client Unit Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.connect.mockResolvedValue(undefined);
        mockClient.shutdown.mockResolvedValue(undefined);
        mockClient.execute.mockResolvedValue({ rows: [] });
    });

    describe('getCassandraClient', () => {
        test('should create a client with correct configuration', () => {
            // Clear previous calls from module import
            mockClientConstructor.mockClear();

            const client = getCassandraClient();

            expect(mockClientConstructor).toHaveBeenCalledWith({
                contactPoints: ['localhost:9042'],
                localDataCenter: 'datacenter1',
                keyspace: 'chime',
                'queryOptions': {
                    'prepare': true,
                },
            });
            expect(client).toBeDefined();
        });

        test('should return the same client instance on multiple calls (singleton)', () => {
            const client1 = getCassandraClient();
            const client2 = getCassandraClient();

            expect(client1).toBe(client2);
            // Note: We can't easily test the singleton behavior with the current implementation
            // since the client is created on first import, but we can verify they're the same instance
        });
    });

    describe('connectToCassandra', () => {
        test('should connect to client and initialize schema', async () => {
            await connectToCassandra();

            expect(mockClient.connect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith({ function: 'connectToCassandra' }, 'Connected to Cassandra');
            expect(mockClient.execute).toHaveBeenCalledWith(
                expect.stringContaining('CREATE KEYSPACE IF NOT EXISTS chime')
            );
        });

        test('should handle connection errors', async () => {
            mockClient.connect.mockRejectedValueOnce(new Error('Connection failed'));

            await expect(connectToCassandra()).rejects.toThrow('Connection failed');
            expect(mockClient.connect).toHaveBeenCalled();
        });
    });

    describe('disconnectFromCassandra', () => {
        test('should shutdown client and reset singleton', async () => {
            // First connect to create a client
            await connectToCassandra();

            // Then disconnect
            await disconnectFromCassandra();

            expect(mockClient.shutdown).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith({ function: 'disconnectFromCassandra' }, 'Disconnected from Cassandra');
        });

        test('should handle case when no client exists', async () => {
            // Call disconnect without connecting first
            await disconnectFromCassandra();

            // Should not throw error and should not log disconnect message
            expect(logger.info).not.toHaveBeenCalledWith({ function: 'disconnectFromCassandra' }, 'Disconnected from Cassandra');
        });
    });
});
