import { Client } from 'cassandra-driver';

const cassandraConfig = {
    contactPoints: [
        'localhost:9042',  // cassandra-1
        'localhost:9043',  // cassandra-2
        'localhost:9044'   // cassandra-3
    ],
    localDataCenter: 'datacenter1',
    keyspace: 'chime',
    consistency: 'QUORUM' as const, // Ensures consistency with replication factor 3
    socketOptions: {
        connectTimeout: 30000,
        readTimeout: 30000
    },
    pooling: {
        maxRequestsPerConnection: 32768
    }
};

let client: Client | null = null;

export const getCassandraClient = (): Client => {
    if (!client) {
        client = new Client(cassandraConfig);
    }
    return client;
};

export const connectToCassandra = async (): Promise<void> => {
    try {
        const cassandraClient = getCassandraClient();
        await cassandraClient.connect();
        console.log('Connected to Cassandra cluster');
    } catch (error) {
        console.error('Failed to connect to Cassandra:', error);
        throw error;
    }
};

export const disconnectFromCassandra = async (): Promise<void> => {
    if (client) {
        await client.shutdown();
        client = null;
        console.log('Disconnected from Cassandra');
    }
};

export default cassandraConfig;
