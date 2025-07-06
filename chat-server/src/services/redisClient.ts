import { createClient, RedisClientType } from 'redis';
import { loadCredentials } from '@/util/Credentials';
import logger from '@/logger';

const log = logger.child({ module: 'redisClient' });

export class ChimeRedisClient {
    private client: RedisClientType | null = null;
    private test: boolean;

    constructor(test: boolean = false) {
        this.test = test;
    }

    getClient(): RedisClientType {
        if (!this.client) {
            const credentials = loadCredentials();

            const host = this.test ? credentials.redis.test.host : credentials.redis.host;
            const port = this.test ? credentials.redis.test.port : credentials.redis.port;
            const password = this.test ? credentials.redis.test.password : credentials.redis.password;

            this.client = createClient({
                socket: {
                    host: host,
                    port: port,
                    reconnectStrategy: (retries: number) => Math.min(retries * 50, 500), // exp backoff
                },
                username: credentials.redis.username,
                password: password,
            });

            this.client.on('error', (error) => log.error(`Redis client error: ${error}`));
            log.info({ function: 'getClient' }, 'Redis client created');
        }

        return this.client;
    }

    async connect(): Promise<void> {
        const client = this.getClient();

        try {
            await client.connect();
            logger.info('Redis client connected successfully');
        } catch (connectError) {
            logger.error(`Failed to connect to redis: ${connectError}`);
            throw new Error('Redis client not connected');
        }
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.disconnect();
            this.client = null;
            log.info({ function: 'disconnect' }, 'Redis client disconnected');
        }
    }
}

// Legacy function for backward compatibility
export async function getClient(test: boolean = false): Promise<RedisClientType> {
    const redisClient = new ChimeRedisClient(test);
    await redisClient.connect();
    return redisClient.getClient();
}
