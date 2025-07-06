import { MessageService } from '@/services/messageService';
import logger from '@/logger';

// Mock dependencies before importing
const mockExecute = jest.fn();
const mockClient = {
    execute: mockExecute
};

const mockMessageIDService = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getNextMessageId: jest.fn().mockResolvedValue(1)
};

jest.mock('@/database/cassandra', () => ({
    getCassandraClient: () => mockClient
}));

jest.mock('@/services/messageIDService', () => ({
    MessageIDService: jest.fn().mockImplementation(() => mockMessageIDService)
}));

jest.mock('@/logger', () => ({
    __esModule: true,
    default: {
        child: jest.fn().mockReturnThis(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('MessageService Unit Tests', () => {
    let messageService: MessageService;

    beforeEach(() => {
        messageService = new MessageService();
        jest.clearAllMocks();
    });

    describe('connect', () => {
        test('should connect MessageIDService', async () => {
            await messageService.connect();

            expect(mockMessageIDService.connect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith({ function: 'connect' }, 'MessageService connected');
        });
    });

    describe('disconnect', () => {
        test('should disconnect MessageIDService', async () => {
            await messageService.disconnect();

            expect(mockMessageIDService.disconnect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith({ function: 'disconnect' }, 'MessageService disconnected');
        });
    });

    describe('saveMessage', () => {
        test('should save message with correct parameters', async () => {
            const channelId = 'test-channel';
            const userId = 'test-user';
            const content = 'Test message';
            const messageId = 42;

            mockMessageIDService.getNextMessageId.mockResolvedValueOnce(messageId);
            mockExecute.mockResolvedValueOnce({ rows: [] });

            const result = await messageService.saveMessage(channelId, userId, content);

            expect(result).toEqual({
                channelId,
                messageId: messageId.toString(),
                userId,
                content,
                createdAt: expect.any(String),
                editedAt: null,
                metadata: {}
            });

            // Verify MessageIDService was called
            expect(mockMessageIDService.getNextMessageId).toHaveBeenCalledWith(channelId);

            // Verify database insert
            expect(mockExecute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO messages'),
                [channelId, messageId.toString(), userId, content, expect.any(Date), null, {}],
                { prepare: true }
            );
        });

        test('should handle MessageIDService errors gracefully', async () => {
            const channelId = 'test-channel';
            const userId = 'test-user';
            const content = 'Test message';

            mockMessageIDService.getNextMessageId.mockRejectedValueOnce(new Error('Redis connection failed'));

            await expect(messageService.saveMessage(channelId, userId, content))
                .rejects.toThrow('Redis connection failed');
        });

        test('should handle database errors gracefully', async () => {
            const channelId = 'test-channel';
            const userId = 'test-user';
            const content = 'Test message';
            const messageId = 42;

            mockMessageIDService.getNextMessageId.mockResolvedValueOnce(messageId);
            mockExecute.mockRejectedValueOnce(new Error('Database connection failed'));

            await expect(messageService.saveMessage(channelId, userId, content))
                .rejects.toThrow('Database connection failed');
        });
    });
});
