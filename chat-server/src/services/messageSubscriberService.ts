import { ChimeRedisClient } from '@/services/redisClient';
import { ChimeMessage } from '@/types/message';
import ChannelManager from '@/util/ChannelManager';
import { UserConnectionManager } from '@/util/UserConnectionManager';
import logger from '@/logger';

const log = logger.child({ module: 'messageSubscriberService' });

export class MessageSubscriberService {
    private redisClient: ChimeRedisClient;
    private channelManager: ChannelManager;
    private userConnectionManager: UserConnectionManager;
    private messageHandlers = new Map<string, (message: ChimeMessage) => void>();
    private subscribedChannels = new Set<string>();
    private isConnected = false;

    constructor(channelManager: ChannelManager, userConnectionManager: UserConnectionManager, test: boolean = false) {
        this.redisClient = new ChimeRedisClient(test);
        this.channelManager = channelManager;
        this.userConnectionManager = userConnectionManager;
    }

    async connect(): Promise<void> {
        await this.redisClient.connect();
        this.isConnected = true;
        log.info({ function: 'connect' }, 'MessageSubscriberService connected to Redis');
    }

    async disconnect(): Promise<void> {
        if (this.isConnected) {
            await this.redisClient.disconnect();
            this.isConnected = false;
            // Clear subscription tracking since we're disconnected
            this.subscribedChannels.clear();
            log.info({ function: 'disconnect' }, 'MessageSubscriberService disconnected from Redis');
        }
    }

    async subscribeTo(channelId: string): Promise<void> {
        if (!this.isConnected) {
            throw new Error('MessageSubscriberService not connected. Call connect() first.');
        }

        // Check if we're already subscribed to this channel
        if (this.subscribedChannels.has(channelId)) {
            log.debug({ function: 'subscribeTo', channelId }, 'Already subscribed to channel - skipping duplicate subscription');
            return;
        }

        const client = this.redisClient.getClient();
        await client.subscribe(channelId, (data: string, channel: string) => {
            try {
                const message: ChimeMessage = JSON.parse(data);
                log.debug({ function: 'onRedisMessage', channelId: channel, messageId: message.messageId }, 'Received message from Redis');
                this.handleMessage(message);
            } catch (error) {
                log.error({ function: 'onRedisMessage', channelId: channel, error }, 'Failed to parse message from Redis');
            }
        });
        
        // Track that we're now subscribed to this channel
        this.subscribedChannels.add(channelId);
        log.info({ function: 'subscribeTo', channelId, totalSubscriptions: this.subscribedChannels.size }, 'Subscribed to channel');
    }

    async unsubscribeFrom(channelId: string): Promise<void> {
        if (!this.isConnected) {
            throw new Error('MessageSubscriberService not connected. Call connect() first.');
        }

        // Check if we're actually subscribed to this channel
        if (!this.subscribedChannels.has(channelId)) {
            log.debug({ function: 'unsubscribeFrom', channelId }, 'Not subscribed to channel - skipping unsubscribe');
            return;
        }

        const client = this.redisClient.getClient();
        await client.unsubscribe(channelId);
        
        // Remove from our tracking
        this.subscribedChannels.delete(channelId);
        log.info({ function: 'unsubscribeFrom', channelId, remainingSubscriptions: this.subscribedChannels.size }, 'Unsubscribed from channel');
    }

    onChannelMessage(channelId: string, handler: (message: ChimeMessage) => void): void {
        this.messageHandlers.set(channelId, handler);
        log.debug({ function: 'onChannelMessage', channelId }, 'Registered message handler for channel');
    }

    removeChannelMessageHandler(channelId: string): void {
        this.messageHandlers.delete(channelId);
        log.debug({ function: 'removeChannelMessageHandler', channelId }, 'Removed message handler for channel');
    }

    private handleMessage(message: ChimeMessage): void {
        const handler = this.messageHandlers.get(message.channelId);
        if (handler) {
            try {
                handler(message);
            } catch (error) {
                log.error({ function: 'handleMessage', channelId: message.channelId, error }, 'Error in message handler');
            }
        } else {
            // Default behavior: broadcast to all users in the channel
            this.broadcastToChannel(message);
        }
    }

    private broadcastToChannel(message: ChimeMessage): void {
        const users = this.channelManager.getUsersInChannel(message.channelId);
        log.debug({ function: 'broadcastToChannel', channelId: message.channelId, userCount: users.length }, 'Broadcasting message to channel users');
        
        users.forEach(userId => {
            this.sendToUser(userId, message);
        });
    }

    sendToUser(userId: string, message: ChimeMessage): boolean {
        const wrappedMessage = { type: 'message' as const, message };
        const messageString = JSON.stringify(wrappedMessage);
        const success = this.userConnectionManager.sendToUser(userId, messageString);
        
        if (success) {
            log.debug({ function: 'sendToUser', userId, messageId: message.messageId }, 'Message sent to user');
        } else {
            log.warn({ function: 'sendToUser', userId, messageId: message.messageId }, 'Failed to send message to user - no active connections');
        }
        
        return success;
    }
}
