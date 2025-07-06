import { ChimeRedisClient } from '@/services/redisClient';
import logger from '@/logger';

const log = logger.child({ module: 'messageIDService' });

export class MessageIDService {
    private redisClient: ChimeRedisClient;

    constructor(test: boolean = false) {
        this.redisClient = new ChimeRedisClient(test);
    }

    async connect(): Promise<void> {
        await this.redisClient.connect();
        log.info({ function: 'connect' }, 'MessageIDService connected to Redis');
    }

    async disconnect(): Promise<void> {
        await this.redisClient.disconnect();
        log.info({ function: 'disconnect' }, 'MessageIDService disconnected from Redis');
    }

    async getNextMessageId(channelId: string): Promise<number> {
        const client = this.redisClient.getClient();
        const key = `channel:${channelId}:message_counter`;
        
        try {
            const messageId = await client.incr(key);
            log.debug({ function: 'getNextMessageId', channelId, messageId }, 'Generated new message ID');
            return messageId;
        } catch (error) {
            log.error({ function: 'getNextMessageId', channelId, error }, 'Failed to generate message ID');
            throw error;
        }
    }
}
