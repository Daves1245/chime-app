CREATE KEYSPACE IF NOT EXISTS chime
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 3
};

USE chime;
