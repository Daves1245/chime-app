// messages by channel
USE chime;
CREATE TABLE IF NOT EXISTS messages (
  channel_id UUID,
  message_id TIMEUUID,
  user_id UUID,
  content TEXT,
  created_at TIMESTAMP,
  edited_at TIMESTAMP,
  metadata MAP<TEXT, TEXT>,
  PRIMARY KEY (channel_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC)
AND comment = 'Messages partitioned by channel';
