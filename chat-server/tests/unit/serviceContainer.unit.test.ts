// Mock all the services before importing
const mockMessageService = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    saveMessage: jest.fn()
};

const mockBroadcastService = {
    init: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn()
};

const mockUserManager = {
    addUserConnection: jest.fn(),
    removeUserConnection: jest.fn(),
    sendToUser: jest.fn()
};

const mockChannelManager = {
    addUserToChannel: jest.fn(),
    removeUserFromChannel: jest.fn(),
    getUsersInChannel: jest.fn()
};

const mockSubscriberService = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribeTo: jest.fn(),
    unsubscribeFrom: jest.fn()
};

jest.mock('@/services/messageService', () => ({
    MessageService: jest.fn().mockImplementation(() => mockMessageService)
}));

jest.mock('@/services/messageBroadcaseService', () => ({
    MessageBroadcastService: jest.fn().mockImplementation(() => mockBroadcastService)
}));

jest.mock('@/util/UserConnectionManager', () => ({
    UserConnectionManager: jest.fn().mockImplementation(() => mockUserManager)
}));

jest.mock('@/util/ChannelManager', () => {
    const MockChannelManager = jest.fn().mockImplementation(() => mockChannelManager);
    return {
        __esModule: true,
        default: MockChannelManager
    };
});

jest.mock('@/services/messageSubscriberService', () => ({
    MessageSubscriberService: jest.fn().mockImplementation(() => mockSubscriberService)
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

import { ServiceContainer } from '@/util/ServiceContainer';
import { MessageService } from '@/services/messageService';
import { MessageBroadcastService } from '@/services/messageBroadcaseService';
import { UserConnectionManager } from '@/util/UserConnectionManager';
import ChannelManager from '@/util/ChannelManager';
import { MessageSubscriberService } from '@/services/messageSubscriberService';
import logger from '@/logger';

describe('ServiceContainer Unit Tests', () => {
    let serviceContainer: ServiceContainer;

    beforeEach(() => {
        jest.clearAllMocks();
        serviceContainer = new ServiceContainer();
    });

    describe('constructor', () => {
        test('should create all services', () => {
            expect(MessageService).toHaveBeenCalledWith(false);
            expect(MessageBroadcastService).toHaveBeenCalledWith(false);
            expect(UserConnectionManager).toHaveBeenCalled();
            expect(ChannelManager).toHaveBeenCalled();
            expect(MessageSubscriberService).toHaveBeenCalledWith(
                mockChannelManager,
                mockUserManager,
                false
            );
            expect(logger.info).toHaveBeenCalledWith(
                { function: 'constructor' },
                'ServiceContainer created successfully'
            );
        });

        test('should create test services when test flag is true', () => {
            jest.clearAllMocks();
            new ServiceContainer(true);

            expect(MessageService).toHaveBeenCalledWith(true);
            expect(MessageBroadcastService).toHaveBeenCalledWith(true);
            expect(MessageSubscriberService).toHaveBeenCalledWith(
                mockChannelManager,
                mockUserManager,
                true
            );
        });

        test('should expose all services as public readonly properties', () => {
            expect(serviceContainer.messageService).toBe(mockMessageService);
            expect(serviceContainer.broadcastService).toBe(mockBroadcastService);
            expect(serviceContainer.userManager).toBe(mockUserManager);
            expect(serviceContainer.channelManager).toBe(mockChannelManager);
            expect(serviceContainer.subscriberService).toBe(mockSubscriberService);
        });
    });

    describe('connect', () => {
        test('should connect all services successfully', async () => {
            await serviceContainer.connect();

            expect(mockMessageService.connect).toHaveBeenCalled();
            expect(mockBroadcastService.init).toHaveBeenCalled();
            expect(mockSubscriberService.connect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(
                { function: 'connect' },
                'All services connected successfully'
            );
        });

        test('should handle service connection errors', async () => {
            const connectionError = new Error('Service connection failed');
            mockMessageService.connect.mockRejectedValueOnce(connectionError);

            await expect(serviceContainer.connect()).rejects.toThrow('Service connection failed');
            expect(logger.error).toHaveBeenCalledWith(
                { function: 'connect', error: connectionError },
                'Failed to connect services'
            );
        });

        test('should handle broadcast service initialization errors', async () => {
            const initError = new Error('Broadcast init failed');
            mockBroadcastService.init.mockRejectedValueOnce(initError);

            await expect(serviceContainer.connect()).rejects.toThrow('Broadcast init failed');
        });

        test('should handle subscriber service connection errors', async () => {
            const subscriptionError = new Error('Subscriber connection failed');
            mockSubscriberService.connect.mockRejectedValueOnce(subscriptionError);

            await expect(serviceContainer.connect()).rejects.toThrow('Subscriber connection failed');
        });
    });

    describe('disconnect', () => {
        test('should disconnect all services successfully', async () => {
            await serviceContainer.disconnect();

            expect(mockSubscriberService.disconnect).toHaveBeenCalled();
            expect(mockBroadcastService.disconnect).toHaveBeenCalled();
            expect(mockMessageService.disconnect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(
                { function: 'disconnect' },
                'All services disconnected successfully'
            );
        });

        test('should handle service disconnection errors', async () => {
            const disconnectionError = new Error('Service disconnection failed');
            mockMessageService.disconnect.mockRejectedValueOnce(disconnectionError);

            await expect(serviceContainer.disconnect()).rejects.toThrow('Service disconnection failed');
            expect(logger.error).toHaveBeenCalledWith(
                { function: 'disconnect', error: disconnectionError },
                'Error during service disconnection'
            );
        });

        test('should disconnect services in correct order', async () => {
            const disconnectOrder: string[] = [];
            
            mockSubscriberService.disconnect.mockImplementation(() => {
                disconnectOrder.push('subscriber');
                return Promise.resolve();
            });
            mockBroadcastService.disconnect.mockImplementation(() => {
                disconnectOrder.push('broadcast');
                return Promise.resolve();
            });
            mockMessageService.disconnect.mockImplementation(() => {
                disconnectOrder.push('message');
                return Promise.resolve();
            });

            await serviceContainer.disconnect();

            expect(disconnectOrder).toEqual(['subscriber', 'broadcast', 'message']);
        });
    });

    describe('service integration', () => {
        test('should provide subscriber service with correct dependencies', () => {
            expect(MessageSubscriberService).toHaveBeenCalledWith(
                mockChannelManager,
                mockUserManager,
                false
            );
        });

        test('should ensure all services are accessible', () => {
            // Verify the container implements the interface correctly
            expect(serviceContainer).toHaveProperty('messageService');
            expect(serviceContainer).toHaveProperty('broadcastService');
            expect(serviceContainer).toHaveProperty('userManager');
            expect(serviceContainer).toHaveProperty('channelManager');
            expect(serviceContainer).toHaveProperty('subscriberService');
        });
    });
});