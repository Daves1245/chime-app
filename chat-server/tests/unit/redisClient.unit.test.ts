import { ChimeRedisClient, getClient } from '@/services/redisClient';
import logger from '@/logger';

// Mock the redis module before importing anything
const mockRedisClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(1),
    isReady: true,
    on: jest.fn()
};

// Get the mocked createClient function
import { createClient } from 'redis';
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

jest.mock('redis', () => ({
    createClient: jest.fn().mockImplementation(() => mockRedisClient)
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

jest.mock('@/util/Credentials', () => ({
    loadCredentials: jest.fn().mockReturnValue({
        api: { host: 'localhost', port: 3145 },
        redis: {
            host: 'localhost',
            port: 6379,
            username: 'default',
            password: 'test-password',
            test: {
                host: 'localhost',
                port: 6380,
                password: 'test-password-for-test'
            }
        },
        cassandra: { host: 'localhost', port: 9042 }
    })
}));

describe('Redis Client Unit Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRedisClient.connect.mockResolvedValue(undefined);
        mockRedisClient.disconnect.mockResolvedValue(undefined);
        mockRedisClient.isReady = true;
    });

    describe('ChimeRedisClient class', () => {
        test('should create a Redis client with correct configuration', () => {
            const redisClient = new ChimeRedisClient();
            const client = redisClient.getClient();

            expect(mockCreateClient).toHaveBeenCalledWith({
                socket: {
                    host: 'localhost',
                    port: 6379,
                    reconnectStrategy: expect.any(Function),
                },
                username: 'default',
                password: 'test-password',
            });
            expect(client).toBeDefined();
        });

        test('should use test configuration when test=true', () => {
            const redisClient = new ChimeRedisClient(true);
            const client = redisClient.getClient();

            expect(mockCreateClient).toHaveBeenCalledWith({
                socket: {
                    host: 'localhost',
                    port: 6380,
                    reconnectStrategy: expect.any(Function),
                },
                username: 'default',
                password: 'test-password-for-test',
            });
            expect(client).toBeDefined();
        });

        test('should set up error event listener', () => {
            const redisClient = new ChimeRedisClient();
            redisClient.getClient();

            expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
        });

        test('should connect to Redis successfully', async () => {
            const redisClient = new ChimeRedisClient();
            await redisClient.connect();

            expect(mockRedisClient.connect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Redis client connected successfully');
        });

        test('should handle connection errors', async () => {
            const connectionError = new Error('Connection failed');
            mockRedisClient.connect.mockRejectedValueOnce(connectionError);

            const redisClient = new ChimeRedisClient();
            await expect(redisClient.connect()).rejects.toThrow('Redis client not connected');
            expect(mockRedisClient.connect).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(`Failed to connect to redis: ${connectionError}`);
        });

        test('should disconnect from Redis successfully', async () => {
            const redisClient = new ChimeRedisClient();
            redisClient.getClient(); // Create client
            await redisClient.disconnect();

            expect(mockRedisClient.disconnect).toHaveBeenCalled();
        });

        test('should return same client instance on multiple getClient calls', () => {
            const redisClient = new ChimeRedisClient();
            const client1 = redisClient.getClient();
            const client2 = redisClient.getClient();

            expect(client1).toBe(client2);
            expect(mockCreateClient).toHaveBeenCalledTimes(1);
        });
    });

    describe('getClient legacy function', () => {
        test('should create and connect Redis client', async () => {
            const client = await getClient();

            expect(mockCreateClient).toHaveBeenCalledWith({
                socket: {
                    host: 'localhost',
                    port: 6379,
                    reconnectStrategy: expect.any(Function),
                },
                username: 'default',
                password: 'test-password',
            });
            expect(mockRedisClient.connect).toHaveBeenCalled();
            expect(client).toBeDefined();
        });

        test('should use test configuration when test=true', async () => {
            const client = await getClient(true);

            expect(mockCreateClient).toHaveBeenCalledWith({
                socket: {
                    host: 'localhost',
                    port: 6380,
                    reconnectStrategy: expect.any(Function),
                },
                username: 'default',
                password: 'test-password-for-test',
            });
            expect(client).toBeDefined();
        });
    });
});
