import { WebSocket } from 'ws';
import logger from '@/logger';

const log = logger.child({ module: 'userConnectionManager' });

export class UserConnectionManager {
    private userConnections = new Map<string, Set<WebSocket>>();

    addUserConnection(userId: string, ws: WebSocket): void {
        if (!this.userConnections.has(userId)) {
            this.userConnections.set(userId, new Set());
        }
        this.userConnections.get(userId)!.add(ws);
        log.debug({ function: 'addUserConnection', userId, totalConnections: this.userConnections.get(userId)!.size }, 'Added user connection');
    }

    removeUserConnection(userId: string, ws: WebSocket): void {
        const connections = this.userConnections.get(userId);
        if (connections) {
            connections.delete(ws);
            if (connections.size === 0) {
                this.userConnections.delete(userId);
            }
            log.debug({ function: 'removeUserConnection', userId, remainingConnections: connections.size }, 'Removed user connection');
        }
    }

    getUserConnections(userId: string): WebSocket[] {
        return Array.from(this.userConnections.get(userId) || []);
    }

    getAllConnectedUsers(): string[] {
        return Array.from(this.userConnections.keys());
    }

    isUserConnected(userId: string): boolean {
        return this.userConnections.has(userId) && this.userConnections.get(userId)!.size > 0;
    }

    sendToUser(userId: string, message: string): boolean {
        const connections = this.userConnections.get(userId);
        if (!connections || connections.size === 0) {
            log.warn({ function: 'sendToUser', userId }, 'No connections found for user');
            return false;
        }

        let sentCount = 0;
        connections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(message);
                    sentCount++;
                } catch (error) {
                    log.error({ function: 'sendToUser', userId, error }, 'Failed to send message to connection');
                }
            }
        });

        log.debug({ function: 'sendToUser', userId, sentCount, totalConnections: connections.size }, 'Sent message to user connections');
        return sentCount > 0;
    }
}
