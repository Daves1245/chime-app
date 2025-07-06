// Mock dependencies before importing
const mockRedisClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    isReady: true
};

const mockRedisClientInstance = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined)
};

jest.mock('@/services/redisClient', () => ({
    ChimeRedisClient: jest.fn().mockImplementation(() => mockRedisClientInstance)
}));

jest.mock('@/logger', () => ({
    __esModule: true,
    default: {
        child: jest.fn().mockReturnThis(),
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
    },
}));

import { MessageSubscriberService } from '@/services/messageSubscriberService';
import { ChimeMessage } from '@/types/message';
import ChannelManager from '@/util/ChannelManager';
import { UserConnectionManager } from '@/util/UserConnectionManager';
import logger from '@/logger';

describe('MessageSubscriberService Unit Tests', () => {
    let service: MessageSubscriberService;
    let channelManager: ChannelManager;
    let userConnectionManager: UserConnectionManager;
    let mockMessage: ChimeMessage;

    beforeEach(() => {
        jest.clearAllMocks();
        channelManager = new ChannelManager();
        userConnectionManager = new UserConnectionManager();
        service = new MessageSubscriberService(channelManager, userConnectionManager);

        mockMessage = {
            channelId: 'test-channel',
            messageId: 'msg-123',
            userId: 'user-456',
            content: 'Hello, world!',
            createdAt: '2023-01-01T00:00:00Z',
            editedAt: null,
            metadata: {}
        };
    });

    describe('connect', () => {
        test('should connect to Redis successfully', async () => {
            await service.connect();

            expect(mockRedisClientInstance.connect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith({ function: 'connect' }, 'MessageSubscriberService connected to Redis');
        });

        test('should handle Redis connection errors', async () => {
            const connectionError = new Error('Redis connection failed');
            mockRedisClientInstance.connect.mockRejectedValueOnce(connectionError);

            await expect(service.connect()).rejects.toThrow('Redis connection failed');
        });
    });

    describe('disconnect', () => {
        test('should disconnect from Redis when connected', async () => {
            await service.connect();
            await service.disconnect();

            expect(mockRedisClientInstance.disconnect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith({ function: 'disconnect' }, 'MessageSubscriberService disconnected from Redis');
        });

        test('should not disconnect when not connected', async () => {
            await service.disconnect();

            expect(mockRedisClientInstance.disconnect).not.toHaveBeenCalled();
        });
    });

    describe('subscribeTo', () => {
        test('should subscribe to channel when connected', async () => {
            await service.connect();
            await service.subscribeTo('test-channel');

            expect(mockRedisClient.subscribe).toHaveBeenCalledWith('test-channel', expect.any(Function));
            expect(logger.debug).toHaveBeenCalledWith({ function: 'subscribeTo', channelId: 'test-channel' }, 'Subscribed to channel');
        });

        test('should throw error when not connected', async () => {
            await expect(service.subscribeTo('test-channel'))
                .rejects.toThrow('MessageSubscriberService not connected. Call connect() first.');
        });
    });

    describe('unsubscribeFrom', () => {
        test('should unsubscribe from channel when connected', async () => {
            await service.connect();
            await service.unsubscribeFrom('test-channel');

            expect(mockRedisClient.unsubscribe).toHaveBeenCalledWith('test-channel');
            expect(logger.debug).toHaveBeenCalledWith({ function: 'unsubscribeFrom', channelId: 'test-channel' }, 'Unsubscribed from channel');
        });

        test('should throw error when not connected', async () => {
            await expect(service.unsubscribeFrom('test-channel'))
                .rejects.toThrow('MessageSubscriberService not connected. Call connect() first.');
        });
    });

    describe('onChannelMessage', () => {
        test('should register message handler for channel', () => {
            const handler = jest.fn();
            service.onChannelMessage('test-channel', handler);

            expect(logger.debug).toHaveBeenCalledWith({ function: 'onChannelMessage', channelId: 'test-channel' }, 'Registered message handler for channel');
        });
    });

    describe('removeChannelMessageHandler', () => {
        test('should remove message handler for channel', () => {
            const handler = jest.fn();
            service.onChannelMessage('test-channel', handler);
            service.removeChannelMessageHandler('test-channel');

            expect(logger.debug).toHaveBeenCalledWith({ function: 'removeChannelMessageHandler', channelId: 'test-channel' }, 'Removed message handler for channel');
        });
    });

    describe('message handling', () => {
        test('should call custom handler when registered', async () => {
            const handler = jest.fn();
            await service.connect();
            service.onChannelMessage('test-channel', handler);
            await service.subscribeTo('test-channel');

            // Simulate receiving a message from Redis via subscribe callback
            const subscribeCallback = mockRedisClient.subscribe.mock.calls[0][1];
            subscribeCallback(JSON.stringify(mockMessage), 'test-channel');

            expect(handler).toHaveBeenCalledWith(mockMessage);
        });

        test('should broadcast to channel users when no custom handler', async () => {
            channelManager.addUserToChannel('test-channel', 'user-1');
            channelManager.addUserToChannel('test-channel', 'user-2');
            
            const sendToUserSpy = jest.spyOn(service, 'sendToUser').mockReturnValue(true);
            
            await service.connect();
            await service.subscribeTo('test-channel');

            // Simulate receiving a message from Redis via subscribe callback
            const subscribeCallback = mockRedisClient.subscribe.mock.calls[0][1];
            subscribeCallback(JSON.stringify(mockMessage), 'test-channel');

            expect(sendToUserSpy).toHaveBeenCalledWith('user-1', mockMessage);
            expect(sendToUserSpy).toHaveBeenCalledWith('user-2', mockMessage);
        });

        test('should handle malformed JSON messages gracefully', async () => {
            await service.connect();
            await service.subscribeTo('test-channel');

            // Simulate receiving malformed message from Redis via subscribe callback
            const subscribeCallback = mockRedisClient.subscribe.mock.calls[0][1];
            subscribeCallback('invalid json', 'test-channel');

            expect(logger.error).toHaveBeenCalledWith(
                { function: 'onRedisMessage', channelId: 'test-channel', error: expect.any(Error) },
                'Failed to parse message from Redis'
            );
        });

        test('should handle errors in custom message handlers', async () => {
            const handler = jest.fn().mockImplementation(() => {
                throw new Error('Handler error');
            });
            
            await service.connect();
            service.onChannelMessage('test-channel', handler);
            await service.subscribeTo('test-channel');

            // Simulate receiving a message from Redis via subscribe callback
            const subscribeCallback = mockRedisClient.subscribe.mock.calls[0][1];
            subscribeCallback(JSON.stringify(mockMessage), 'test-channel');

            expect(logger.error).toHaveBeenCalledWith(
                { function: 'handleMessage', channelId: 'test-channel', error: expect.any(Error) },
                'Error in message handler'
            );
        });
    });

    describe('sendToUser', () => {
        test('should send message to user via UserConnectionManager', () => {
            const sendToUserSpy = jest.spyOn(userConnectionManager, 'sendToUser').mockReturnValue(true);
            
            const result = service.sendToUser('user-123', mockMessage);

            expect(sendToUserSpy).toHaveBeenCalledWith('user-123', JSON.stringify({ type: 'message', message: mockMessage }));
            expect(result).toBe(true);
            expect(logger.debug).toHaveBeenCalledWith(
                { function: 'sendToUser', userId: 'user-123', messageId: 'msg-123' },
                'Message sent to user'
            );
        });

        test('should handle failed message sending', () => {
            jest.spyOn(userConnectionManager, 'sendToUser').mockReturnValue(false);
            
            const result = service.sendToUser('user-123', mockMessage);

            expect(result).toBe(false);
            expect(logger.warn).toHaveBeenCalledWith(
                { function: 'sendToUser', userId: 'user-123', messageId: 'msg-123' },
                'Failed to send message to user - no active connections'
            );
        });
    });
});
