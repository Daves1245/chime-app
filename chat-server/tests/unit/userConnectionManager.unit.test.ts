import { WebSocket } from 'ws';
import { UserConnectionManager } from '@/util/UserConnectionManager';

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

describe('UserConnectionManager Unit Tests', () => {
    let manager: UserConnectionManager;
    let mockWs1: MockWebSocket;
    let mockWs2: MockWebSocket;

    beforeEach(() => {
        manager = new UserConnectionManager();
        
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
    });

    describe('addUserConnection', () => {
        test('should add new user connection', () => {
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);

            expect(manager.isUserConnected('user1')).toBe(true);
            expect(manager.getUserConnections('user1')).toEqual([mockWs1]);
        });

        test('should add multiple connections for same user', () => {
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);
            manager.addUserConnection('user1', mockWs2 as unknown as WebSocket);

            expect(manager.getUserConnections('user1')).toHaveLength(2);
            expect(manager.getUserConnections('user1')).toContain(mockWs1);
            expect(manager.getUserConnections('user1')).toContain(mockWs2);
        });
    });

    describe('removeUserConnection', () => {
        test('should remove user connection', () => {
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);
            manager.removeUserConnection('user1', mockWs1 as unknown as WebSocket);

            expect(manager.isUserConnected('user1')).toBe(false);
            expect(manager.getUserConnections('user1')).toEqual([]);
        });

        test('should remove only specified connection when user has multiple', () => {
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);
            manager.addUserConnection('user1', mockWs2 as unknown as WebSocket);
            manager.removeUserConnection('user1', mockWs1 as unknown as WebSocket);

            expect(manager.isUserConnected('user1')).toBe(true);
            expect(manager.getUserConnections('user1')).toEqual([mockWs2]);
        });

        test('should handle removing non-existent connection gracefully', () => {
            manager.removeUserConnection('nonexistent', mockWs1 as unknown as WebSocket);

            expect(manager.isUserConnected('nonexistent')).toBe(false);
        });
    });

    describe('getUserConnections', () => {
        test('should return empty array for non-existent user', () => {
            expect(manager.getUserConnections('nonexistent')).toEqual([]);
        });

        test('should return all connections for user', () => {
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);
            manager.addUserConnection('user1', mockWs2 as unknown as WebSocket);

            const connections = manager.getUserConnections('user1');
            expect(connections).toHaveLength(2);
            expect(connections).toContain(mockWs1);
            expect(connections).toContain(mockWs2);
        });
    });

    describe('getAllConnectedUsers', () => {
        test('should return empty array when no users connected', () => {
            expect(manager.getAllConnectedUsers()).toEqual([]);
        });

        test('should return all connected users', () => {
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);
            manager.addUserConnection('user2', mockWs2 as unknown as WebSocket);

            const users = manager.getAllConnectedUsers();
            expect(users).toHaveLength(2);
            expect(users).toContain('user1');
            expect(users).toContain('user2');
        });
    });

    describe('isUserConnected', () => {
        test('should return false for non-existent user', () => {
            expect(manager.isUserConnected('nonexistent')).toBe(false);
        });

        test('should return true for connected user', () => {
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);
            expect(manager.isUserConnected('user1')).toBe(true);
        });

        test('should return false after all connections removed', () => {
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);
            manager.removeUserConnection('user1', mockWs1 as unknown as WebSocket);
            expect(manager.isUserConnected('user1')).toBe(false);
        });
    });

    describe('sendToUser', () => {
        test('should send message to all user connections', () => {
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);
            manager.addUserConnection('user1', mockWs2 as unknown as WebSocket);

            const result = manager.sendToUser('user1', 'test message');

            expect(result).toBe(true);
            expect(mockWs1.send).toHaveBeenCalledWith('test message');
            expect(mockWs2.send).toHaveBeenCalledWith('test message');
        });

        test('should return false for non-existent user', () => {
            const result = manager.sendToUser('nonexistent', 'test message');
            expect(result).toBe(false);
        });

        test('should skip closed connections', () => {
            mockWs1.readyState = WebSocket.CLOSED;
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);
            manager.addUserConnection('user1', mockWs2 as unknown as WebSocket);

            const result = manager.sendToUser('user1', 'test message');

            expect(result).toBe(true);
            expect(mockWs1.send).not.toHaveBeenCalled();
            expect(mockWs2.send).toHaveBeenCalledWith('test message');
        });

        test('should handle send errors gracefully', () => {
            mockWs1.send.mockImplementation(() => {
                throw new Error('Send failed');
            });
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);
            manager.addUserConnection('user1', mockWs2 as unknown as WebSocket);

            const result = manager.sendToUser('user1', 'test message');

            expect(result).toBe(true); // Should still return true because mockWs2 succeeded
            expect(mockWs2.send).toHaveBeenCalledWith('test message');
        });

        test('should return false when no connections can receive message', () => {
            mockWs1.readyState = WebSocket.CLOSED;
            mockWs2.readyState = WebSocket.CLOSED;
            manager.addUserConnection('user1', mockWs1 as unknown as WebSocket);
            manager.addUserConnection('user1', mockWs2 as unknown as WebSocket);

            const result = manager.sendToUser('user1', 'test message');

            expect(result).toBe(false);
        });
    });
});
