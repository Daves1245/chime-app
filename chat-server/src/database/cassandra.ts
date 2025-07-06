import { Client } from 'cassandra-driver';
import { loadCredentials } from '@/util/Credentials';
import logger from '@/logger';

const log = logger.child({ module: 'cassandra' });
let client: Client | null = null;

export function getCassandraClient(): Client {
    log.debug({ function: 'getCassandraClient' }, 'Getting Cassandra client');

    if (!client) {
        const credentials = loadCredentials();
        const contactPoints = [`${credentials.cassandra.host}:${credentials.cassandra.port}`];

        client = new Client({
            contactPoints,
            localDataCenter: 'datacenter1',
            keyspace: 'chime',
            queryOptions: { prepare: true }
        });

        log.debug({ function: 'getCassandraClient', contactPoints }, 'Cassandra client created');
    }
    return client;
}

export async function connectToCassandra(): Promise<void> {
    log.debug({ function: 'connectToCassandra' }, 'Connecting to Cassandra');

    const cassandraClient = getCassandraClient();
    await cassandraClient.connect();
    log.info({ function: 'connectToCassandra' }, 'Connected to Cassandra');

    // Initialize keyspace and tables
    await initializeSchema();
}

export async function disconnectFromCassandra(): Promise<void> {
    log.debug({ function: 'disconnectFromCassandra' }, 'Disconnecting from Cassandra');

    if (client) {
        await client.shutdown();
        client = null;
        log.info({ function: 'disconnectFromCassandra' }, 'Disconnected from Cassandra');
    }
}

async function initializeSchema(): Promise<void> {
    log.debug({ function: 'initializeSchema' }, 'Initializing Cassandra schema');

    const cassandraClient = getCassandraClient();

    // Create keyspace if it doesn't exist
    await cassandraClient.execute(`
        CREATE KEYSPACE IF NOT EXISTS chime
        WITH replication = {
            'class': 'SimpleStrategy',
            'replication_factor': 1
        }
    `);

    // Use the keyspace
    await cassandraClient.execute('USE chime');

    // Drop the table to ensure schema changes are applied
    await cassandraClient.execute('DROP TABLE IF EXISTS messages');

    // Create messages table
    await cassandraClient.execute(`
        CREATE TABLE IF NOT EXISTS messages (
            channel_id TEXT,
            message_id TEXT,
            user_id TEXT,
            content TEXT,
            created_at TIMESTAMP,
            edited_at TIMESTAMP,
            metadata MAP<TEXT, TEXT>,
            PRIMARY KEY (channel_id, message_id)
        ) WITH CLUSTERING ORDER BY (message_id ASC)
    `);

    // Create counter table for message IDs per channel
    await cassandraClient.execute(`
        CREATE TABLE IF NOT EXISTS message_counters (
            channel_id TEXT PRIMARY KEY,
            counter_value COUNTER
        )
    `);

    log.info({ function: 'initializeSchema' }, 'Cassandra schema initialized successfully');
}
