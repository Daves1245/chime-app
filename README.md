# Chime App

A real-time chat application built with a microservices architecture, featuring a Next.js frontend, Express API backend, and WebSocket chat server.

## Architecture

- **Frontend** (`frontend/`) - Next.js/React UI with Electron desktop app support
- **API** (`api/`) - Express.js REST API for user/server/channel management
- **Chat Server** (`chat-server/`) - WebSocket server for real-time messaging

## Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Electron
- **Backend**: Node.js, Express, TypeScript
- **Chat**: WebSocket (ws), Redis pub/sub
- **Database**: PostgreSQL, Cassandra
- **Infrastructure**: Docker, Docker Compose

## TODO

- [ ] JWT integration
- [ ] Google OAuth
- [ ] Consolidate build/run process
- [ ] Setup GitHub CI/CD
- [ ] User inboxes w/ Kafka
- [ ] Online status
- [ ] Push notifications

## Getting Started

Each subproject has its own README with specific setup instructions:

- [Frontend Setup](frontend/README.md)
- [API Setup](api/README.md) 
- [Chat Server Setup](chat-server/README.md)
