# Chime API

REST API backend for the Chime chat application, handling user management, server/channel operations, and data persistence.

## Features

- User CRUD operations
- Server and channel management
- PostgreSQL integration for relational data
- Cassandra integration for message storage
- CORS-enabled for frontend integration

## Stack

- Node.js + Express.js
- TypeScript
- PostgreSQL (users, servers, channels)
- Cassandra (messages)
- Jest for testing

## Getting Started

1. dependencies:
   ```bash
   npm install
   ```

2. TODO credentials integration with docker

3. Start development server:
   ```bash
   npm run dev
   ```

4. Run tests:
   ```bash
   npm test
   ```

## API Endpoints

- `GET /users` - List all users
- `POST /users` - Create user
- `GET /servers` - List servers
- `POST /servers` - Create server
- `GET /channels` - List channels
- `POST /channels` - Create channel
