# Chime Chat Server - Design Document

## Overview

Chime Chat is a real-time messaging server built with Node.js, TypeScript, and WebSockets. The system provides scalable chat functionality with persistent message storage and real-time message broadcasting capabilities.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    WebSocket   ┌─────────────────┐
│   Chat Clients  │ ◄────────────► │  Chime Server   │
└─────────────────┘                └─────────────────┘
                                            │
                                            ▼
                      ┌─────────────────────────────────────┐
                      │         Core Services               │
                      │  ┌─────────────┐ ┌─────────────────┐│
                      │  │ Message     │ │ Message         ││
                      │  │ Service     │ │ Subscriber      ││
                      │  └─────────────┘ │ Service         ││
                      │  ┌─────────────┐ └─────────────────┘│
                      │  │ Message     │ ┌─────────────────┐│
                      │  │ Broadcast   │ │ User Connection ││
                      │  │ Service     │ │ Manager         ││
                      │  └─────────────┘ └─────────────────┘│
                      └─────────────────────────────────────┘
                                         │
                    ┌────────────────────┼───────────────────────┐
                    ▼                    ▼                       ▼
            ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
            │   Redis     │        │  Cassandra  │        │   Logger    │
            │  (Pub/Sub)  │        │ (Messages)  │        │   (Pino)    │
            └─────────────┘        └─────────────┘        └─────────────┘
```

### Core Components

#### 1. WebSocket Server (`src/index.ts`)
- **Purpose**: Main entry point handling client connections and message routing
- **Responsibilities**:
  - Accept WebSocket connections
  - Parse incoming messages (JSON or plain text)
  - Route messages to appropriate services
  - Broadcast responses to clients
  - Graceful shutdown handling

#### 2. Message Service (`src/services/messageService.ts`)
- **Purpose**: Handles message persistence and ID generation
- **Responsibilities**:
  - Generate unique message IDs per channel
  - Save messages to Cassandra database
  - Validate message structure
  - Handle database errors gracefully

#### 3. Message Broadcast Service (`src/services/messageBroadcaseService.ts`)
- **Purpose**: Publishes messages via Redis Pub/Sub for real-time distribution
- **Responsibilities**:
  - Connect to Redis instance
  - Publish messages to channel-specific topics
  - Handle Redis connection failures
  - Manage connection lifecycle

#### 4. Message Subscriber Service (`src/services/messageSubscriberService.ts`)
- **Purpose**: Subscribes to Redis channels and routes messages to connected users
- **Responsibilities**:
  - Subscribe to Redis channels
  - Parse incoming Redis messages
  - Route messages to appropriate users via WebSocket
  - Handle custom message handlers per channel
  - Manage subscription lifecycle

#### 5. User Connection Manager (`src/util/UserConnectionManager.ts`)
- **Purpose**: Tracks WebSocket connections by user ID
- **Responsibilities**:
  - Map user IDs to WebSocket connections
  - Support multiple connections per user
  - Send messages to specific users
  - Handle connection cleanup
  - Graceful error handling for failed sends

#### 6. Channel Manager (`src/util/ChannelManager.ts`)
- **Purpose**: Manages user subscriptions to channels
- **Responsibilities**:
  - Track which users are in which channels
  - Add/remove users from channels
  - Query users in specific channels
  - Clean up empty channels

#### 7. Redis Client (`src/services/redisClient.ts`)
- **Purpose**: Manages Redis connections with proper lifecycle management
- **Responsibilities**:
  - Establish Redis connections
  - Handle connection errors and reconnection
  - Support test and production environments
  - Provide connection pooling

#### 8. Cassandra Database (`src/database/cassandra.ts`)
- **Purpose**: Handles persistent message storage
- **Responsibilities**:
  - Manage Cassandra connections
  - Initialize database schema
  - Provide query interface
  - Handle connection lifecycle

## Data Models

### ChimeMessage
```typescript
interface ChimeMessage {
    channelId: string;        // Channel identifier
    channelName?: string;     // Optional human-readable channel name
    messageId: string;        // Unique message ID within channel
    userId: string;           // Message sender ID
    content: string;          // Message content
    createdAt: string;        // ISO timestamp
    editedAt: string | null;  // Edit timestamp or null
    metadata: Record<string, string>; // Extensible metadata
}
```

### ConnectConfig
```typescript
interface ConnectConfig {
    channels: Array<string>; // Channels user wants to subscribe to
}
```

## Data Flow

### Message Sending Flow
1. **Client Connection**: Client establishes WebSocket connection
2. **Message Reception**: Server receives message via WebSocket
3. **Message Parsing**: Parse JSON or treat as plain text
4. **Message Persistence**: Save to Cassandra via MessageService
5. **Message Broadcasting**: Publish to Redis via MessageBroadcastService
6. **Message Distribution**: MessageSubscriberService receives from Redis
7. **User Delivery**: Route to specific users via UserConnectionManager

### User Connection Flow
1. **WebSocket Connection**: Client connects to server
2. **Handshake**: Client sends ConnectConfig with channel subscriptions
3. **User Registration**: UserConnectionManager tracks connection
4. **Channel Subscription**: ChannelManager adds user to channels
5. **Redis Subscription**: MessageSubscriberService subscribes to channels

## Database Design

### Cassandra Schema

#### Messages Table
```sql
CREATE TABLE messages (
    channel_id TEXT,
    message_id TEXT,
    user_id TEXT,
    content TEXT,
    created_at TIMESTAMP,
    edited_at TIMESTAMP,
    metadata MAP<TEXT, TEXT>,
    PRIMARY KEY (channel_id, message_id)
) WITH CLUSTERING ORDER BY (message_id ASC)
```

#### Message Counters Table
```sql
CREATE TABLE message_counters (
    channel_id TEXT PRIMARY KEY,
    counter_value COUNTER
)
```

### Redis Usage
- **Pub/Sub Channels**: One channel per chat channel (e.g., `channel:general`)
- **Message Format**: JSON-serialized ChimeMessage objects
- **Connection Management**: Separate connections for publishing and subscribing

## Configuration

### Credentials (`credentials/credentials.toml`)
```toml
[api]
host = "localhost"
port = 3142

[chat]
port = 3143

[redis]
host = "localhost"
port = 6379
username = "default"
password = "..."

[redis.test]
host = "localhost"
port = 6380
password = "..."

[cassandra]
host = "localhost"
port = 9042
```

## Logging

### Structured Logging with Pino
- **Format**: JSON structured logs
- **Levels**: debug, info, warn, error
- **Context**: Each module uses child loggers with module identification
- **Development**: Pretty-printed output via pino-pretty
- **Production**: JSON output for log aggregation

### Log Structure
```json
{
  "level": 30,
  "time": "2023-01-01T12:00:00.000Z",
  "module": "messageService",
  "function": "saveMessage",
  "channelId": "general",
  "userId": "user123",
  "msg": "Message saved successfully"
}
```

## Error Handling

### Connection Resilience
- **Redis**: Automatic reconnection with exponential backoff
- **Cassandra**: Connection pooling and retry logic
- **WebSocket**: Graceful connection cleanup on errors

### Message Delivery
- **Best Effort**: Messages are delivered to currently connected users
- **Persistence**: All messages saved to Cassandra regardless of delivery
- **Error Isolation**: Failed delivery to one user doesn't affect others

## Testing Strategy

### Unit Tests
- **Services**: Mock external dependencies (Redis, Cassandra)
- **Utilities**: Test core logic in isolation
- **Coverage**: Comprehensive test coverage for all business logic

### Integration Tests
- **Database**: Real Cassandra connections with test data
- **Redis**: Real Redis connections with test instances
- **End-to-End**: WebSocket message flow testing

## Scalability Considerations

### Horizontal Scaling
- **Stateless Design**: Server instances don't share state
- **Redis Pub/Sub**: Enables message distribution across instances
- **Load Balancing**: WebSocket connections can be distributed

### Performance Optimizations
- **Connection Pooling**: Efficient database connection management
- **Message Batching**: Potential for batching Redis operations
- **Caching**: User connection state cached in memory

## Security Considerations

### Authentication
- **User Identification**: Currently uses simple user IDs
- **Future**: Token-based authentication integration planned

### Data Protection
- **Credentials**: Stored in separate configuration files
- **Environment Separation**: Test and production Redis instances
- **Input Validation**: Message parsing with error handling

## Deployment

### Dependencies
- **Node.js**: Runtime environment
- **Redis**: Message broker and caching
- **Cassandra**: Persistent storage
- **TypeScript**: Development and build tooling

### Environment Setup
- **Development**: Local Redis and Cassandra instances
- **Testing**: Separate test database instances
- **Production**: Clustered Redis and Cassandra deployments

## Future Enhancements

### Planned Features
- **User Authentication**: JWT-based authentication system
- **Message History**: API for retrieving historical messages
- **File Uploads**: Support for media message types
- **Message Reactions**: Emoji reactions and message threading
- **Presence Indicators**: Online/offline user status

### Technical Improvements
- **Message Queuing**: Reliable message delivery guarantees
- **Rate Limiting**: Protection against message spam
- **Monitoring**: Metrics and health check endpoints
- **API Gateway**: REST API for non-WebSocket operations

## Conclusion

The Chime Chat server provides a solid foundation for real-time messaging with a focus on scalability, reliability, and maintainability. The modular architecture allows for easy extension and modification while the comprehensive testing strategy ensures system reliability.
