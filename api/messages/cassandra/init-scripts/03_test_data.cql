-- init-scripts/03_test_data.cql (optional)
-- Insert some test message data for development/testing

-- Note: In production, user_id and channel_id would come from your relational database
-- These are just sample UUIDs for testing Cassandra operations

-- Sample channel and user UUIDs for testing
-- channel_id: 550e8400-e29b-41d4-a716-446655440000 (general channel)
-- user_id: 550e8400-e29b-41d4-a716-446655440001 (alice)
-- user_id: 550e8400-e29b-41d4-a716-446655440002 (bob)

USE chime;
-- Insert test messages
INSERT INTO messages (channel_id, message_id, user_id, content, created_at, metadata)
VALUES (550e8400-e29b-41d4-a716-446655440000, now(), 550e8400-e29b-41d4-a716-446655440001, 'Hello everyone!', toTimestamp(now()), {'type': 'text'});

INSERT INTO messages (channel_id, message_id, user_id, content, created_at, metadata)
VALUES (550e8400-e29b-41d4-a716-446655440000, now(), 550e8400-e29b-41d4-a716-446655440002, 'Hey Alice!', toTimestamp(now()), {'type': 'text'});
