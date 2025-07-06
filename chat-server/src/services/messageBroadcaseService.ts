import { ChimeRedisClient } from '@/services/redisClient';
import { ChimeMessage } from '@/types/message';
import logger from '@/logger';

export class MessageBroadcastService {
    private redisClient: ChimeRedisClient;
    
    constructor(test: boolean = false) {
        this.redisClient = new ChimeRedisClient(test);
    }

    async init() {
        await this.redisClient.connect();
    }

    /*
     *
     * Publish a Chime message through redis pub/sub
     *
     */
    async publish(message: ChimeMessage) {
        const client = this.redisClient.getClient();
        
        if (!client || !client.isReady) {
            logger.error('init() needs to be called before broadcasting messages');
            throw new Error('Broadcast not initialized before call');
        }

        const targetChannel = message.channelId;
        logger.debug(`target channel: ${targetChannel}`);

        const payload = JSON.stringify(message);

        try {
            await client.publish(targetChannel, payload);
        } catch (error) {
            logger.error(`Error broadcasting message to channel ${targetChannel}: ${error}`);
            throw new Error(`Failed to broadcast message: ${(error as Error).message}`);
        }
    }

    async disconnect() {
        await this.redisClient.disconnect();
    }
};
