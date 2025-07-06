import logger from '@/logger';
import { z } from 'zod';
import { readFileSync } from 'fs'; // read credentials file
import { load } from 'js-toml';

const log = logger.child({ module: 'credentials' });

// Define the expected structure of the TOML data
interface TomlData {
    api: {
        host: string;
        port: number;
    };
    chat: {
        port: number;
    };
    redis: {
        host: string;
        port: number;
        username: string;
        password: string;
        test: {
            host: string;
            port: number;
            password: string;
        };
    };
    cassandra: {
        host: string;
        port: number;
    };
}

const CredentialsSchema = z.object({
    api: z.object({
        host: z.string(),
        port: z.number(),
    }),
    chat: z.object({
        port: z.number(),
    }),
    redis: z.object({
        host: z.string(),
        port: z.number(),
        username: z.string(),
        password: z.string(),
        test: z.object({
            host: z.string(),
            port: z.number(),
            password: z.string(),
        }),
    }),
    cassandra: z.object({
        host: z.string(),
        port: z.number(),
    }),
});

export type Credentials = z.infer<typeof CredentialsSchema>;

// TODO this should only be set once, or use a better logging system
export function loadCredentials(): Credentials {
    log.debug({ function: 'loadCredentials' }, 'Loading credentials');

    try {
        const fileContent = readFileSync('./credentials/credentials.toml', 'utf8');
        const data = load(fileContent) as TomlData;

        log.info({ function: 'loadCredentials' }, 'Credentials data parsed');

        const credentials = CredentialsSchema.parse({
            api: {
                host: data.api.host,
                port: data.api.port,
            },
            chat: {
                port: data.chat.port,
            },
            redis: {
                host: data.redis.host,
                port: data.redis.port,
                username: data.redis.username,
                password: data.redis.password,
                test: {
                    host: data.redis.test.host,
                    port: data.redis.test.port,
                    password: data.redis.test.password,
                },
            },
            cassandra: {
                host: data.cassandra.host,
                port: data.cassandra.port,
            },
        });

        log.info({ function: 'loadCredentials' }, 'Credentials loaded and validated successfully');
        return credentials;
    } catch (error) {
        log.error({ function: 'loadCredentials', error }, 'Failed to validate credentials');
        process.exit(1);
    }
}
