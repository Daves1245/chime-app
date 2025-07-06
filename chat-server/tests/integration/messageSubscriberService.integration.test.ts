import { MessageSubscriberService } from '@/services/messageSubscriberService';
import { ChimeMessage } from '@/types/message';
import ChannelManager from '@/util/ChannelManager';
import { UserConnectionManager } from '@/util/UserConnectionManager';
import { WebSocket } from 'ws';

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

interface MockWebSocket {
    readyState: number;
    send: jest.Mock;
    close: jest.Mock;
    terminate: jest.Mock;
}

describe('MessageSubscriberService Integration Tests', () => {
    let subscriberService: MessageSubscriberService;
    let channelManager: ChannelManager;
    let userConnectionManager: UserConnectionManager;
    let mockWs1: MockWebSocket;
    let mockWs2: MockWebSocket;

    const testChannelId = `test-channel-${Date.now()}`;
    const testUserId1 = 'test-user-1';
    const testUserId2 = 'test-user-2';

    beforeAll(async () => {
        // Initialize services with test=true to use test Redis instance
        channelManager = new ChannelManager();
        userConnectionManager = new UserConnectionManager();
        subscriberService = new MessageSubscriberService(channelManager, userConnectionManager, true);

        // Create mock WebSocket connections
        mockWs1 = {
            readyState: WebSocket.OPEN,
            send: jest.fn(),
            close: jest.fn(),
            terminate: jest.fn(),
        };

        mockWs2 = {
            readyState: WebSocket.OPEN,
            send: jest.fn(),
            close: jest.fn(),
            terminate: jest.fn(),
        };

        // Set up user connections
        userConnectionManager.addUserConnection(testUserId1, mockWs1 as unknown as WebSocket);
        userConnectionManager.addUserConnection(testUserId2, mockWs2 as unknown as WebSocket);

        // Add users to channel
        channelManager.addUserToChannel(testChannelId, testUserId1);
        channelManager.addUserToChannel(testChannelId, testUserId2);

        // Connect service
        await subscriberService.connect();
    }, 10000);

    afterAll(async () => {
        // Clean up connections
        await subscriberService.disconnect();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Redis Connection', () => {
        test('should connect to Redis successfully', async () => {
            // Service should already be connected from beforeAll
            expect(subscriberService).toBeDefined();
        });

        test('should subscribe and unsubscribe from channels', async () => {
            const testChannel = `subscribe-test-${Date.now()}`;

            // Should not throw when subscribing
            await expect(subscriberService.subscribeTo(testChannel)).resolves.not.toThrow();

            // Should not throw when unsubscribing
            await expect(subscriberService.unsubscribeFrom(testChannel)).resolves.not.toThrow();
        });
    });

    describe('Message Handling', () => {
        test('should register and remove custom message handlers', () => {
            const testChannel = `handler-test-${Date.now()}`;
            const handler = jest.fn();

            // Register handler
            subscriberService.onChannelMessage(testChannel, handler);

            // Remove handler
            subscriberService.removeChannelMessageHandler(testChannel);

            // Should complete without errors
            expect(handler).not.toHaveBeenCalled();
        });

        test('should send messages to users via UserConnectionManager', () => {
            const testMessage: ChimeMessage = {
                channelId: testChannelId,
                messageId: 'direct-send-test',
                userId: 'sender-user',
                content: 'Direct send test message',
                createdAt: new Date().toISOString(),
                editedAt: null,
                metadata: {}
            };

            // Send message directly to user
            const result = subscriberService.sendToUser(testUserId1, testMessage);

            expect(result).toBe(true);
            expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify({ type: 'message', message: testMessage }));
        });

        test('should handle sending to non-existent users', () => {
            const testMessage: ChimeMessage = {
                channelId: testChannelId,
                messageId: 'non-existent-test',
                userId: 'sender-user',
                content: 'Test message to non-existent user',
                createdAt: new Date().toISOString(),
                editedAt: null,
                metadata: {}
            };

            // Send message to non-existent user
            const result = subscriberService.sendToUser('non-existent-user', testMessage);

            expect(result).toBe(false);
        });
    });

    describe('Channel Management Integration', () => {
        test('should broadcast to all users in a channel', () => {
            const testMessage: ChimeMessage = {
                channelId: testChannelId,
                messageId: 'broadcast-test',
                userId: 'sender-user',
                content: 'Broadcast test message',
                createdAt: new Date().toISOString(),
                editedAt: null,
                metadata: {}
            };

            // Manually trigger broadcast (simulating what would happen from Redis)
            subscriberService['broadcastToChannel'](testMessage);

            // Both users should receive the message
            expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify({ type: 'message', message: testMessage }));
            expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify({ type: 'message', message: testMessage }));
        });

        test('should handle custom message handlers correctly', () => {
            const customChannelId = `custom-handler-${Date.now()}`;
            const customHandler = jest.fn();

            // Register custom handler
            subscriberService.onChannelMessage(customChannelId, customHandler);

            const testMessage: ChimeMessage = {
                channelId: customChannelId,
                messageId: 'custom-handler-test',
                userId: 'sender-user',
                content: 'Custom handler test message',
                createdAt: new Date().toISOString(),
                editedAt: null,
                metadata: {}
            };

            // Manually trigger message handling
            subscriberService['handleMessage'](testMessage);

            // Custom handler should be called
            expect(customHandler).toHaveBeenCalledWith(testMessage);

            // Clean up
            subscriberService.removeChannelMessageHandler(customChannelId);
        });
    });

    describe('Error Handling', () => {
        test('should handle WebSocket send errors gracefully', () => {
            const failingWs: MockWebSocket = {
                readyState: WebSocket.OPEN,
                send: jest.fn().mockImplementation(() => {
                    throw new Error('WebSocket send failed');
                }),
                close: jest.fn(),
                terminate: jest.fn(),
            };

            const failingUserId = 'failing-user';
            userConnectionManager.addUserConnection(failingUserId, failingWs as unknown as WebSocket);

            const testMessage: ChimeMessage = {
                channelId: testChannelId,
                messageId: 'error-handling-test',
                userId: 'sender-user',
                content: 'Error handling test message',
                createdAt: new Date().toISOString(),
                editedAt: null,
                metadata: {}
            };

            // Should not throw even with failing WebSocket
            expect(() => {
                subscriberService.sendToUser(failingUserId, testMessage);
            }).not.toThrow();

            // Clean up
            userConnectionManager.removeUserConnection(failingUserId, failingWs as unknown as WebSocket);
        });

        test('should handle malformed message parsing', () => {
            // Manually trigger malformed message handling
            expect(() => {
                subscriberService['handleMessage']({} as ChimeMessage);
            }).not.toThrow();
        });
    });
});
