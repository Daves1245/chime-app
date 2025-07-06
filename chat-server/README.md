# Chime Chat Server

WebSocket server for real-time messaging in the Chime chat application. Handles live chat, message broadcasting, and persistence.

## Features

- WebSocket connections for real-time messaging
- Redis pub/sub for message broadcasting
- Cassandra integration for message persistence
- User connection management
- Channel-based messaging

## Stack

- Node.js + WebSocket (ws)
- TypeScript
- Redis (pub/sub, caching)
- Cassandra (message storage)
- Jest for testing

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up credentials in `credentials/credentials.toml` (copy from `credentials.example.toml`)

3. Start Redis and Cassandra services:
   ```bash
   docker-compose -f redis/docker-compose.yml up -d
   # Instructions for starting Cassandra are in the api/ project
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

5. Run tests:
   ```bash
   npm test
   ```

## Message Protocol

The server accepts JSON messages with the following structure:
- `type`: Message type (`connect`, `chat`)
- `data`: Message payload
- `channel`: Target channel (for chat messages)

## Testing

- All tests: `npm run test`
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- E2E tests: `npm run test:e2e`
