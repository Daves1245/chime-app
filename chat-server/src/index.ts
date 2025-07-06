import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { loadCredentials } from '@/util/Credentials';
import { connectToCassandra, disconnectFromCassandra } from '@/database/cassandra';
import { ServiceContainer } from '@/util/ServiceContainer';
import { isValidMessage, isConnectMessage, isChatMessage } from '@/types/message';
import logger from '@/logger';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const log = logger.child({ module: 'index' });
const credentials = loadCredentials();
const services = new ServiceContainer();

let wss: WebSocketServer;

class ChimeServer {
    constructor() {}

    async start(): Promise<void> {
        log.debug({ function: 'startServer' }, 'Starting server');

        try {
            await connectToCassandra();
            await services.connect(); // Connect all services

            // Set up message routing from Redis to WebSocket clients
            // The subscriber service will automatically broadcast to users in channels
            // via the default behavior in MessageSubscriberService.broadcastToChannel

        } catch (err) {
            log.error({ function: 'startServer', error: err }, 'Failed to connect to services');
            process.exit(1);
        }

        wss = new WebSocketServer({
            port: credentials.chat.port,
            // Disable compression to avoid potential issues
            perMessageDeflate: false
        });

        wss.on('listening', () => {
            log.info({ function: 'startServer', port: credentials.chat.port }, `WebSocketServer started on port ${credentials.chat.port}`);
        });

        wss.on('connection', (ws: WebSocket, request) => {
            const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            log.info({ 
                function: 'startServer.onConnection', 
                connectionId,
                origin: request.headers.origin,
                userAgent: request.headers['user-agent'],
                remoteAddress: request.socket.remoteAddress,
                connectedAt: new Date().toISOString()
            }, 'New WebSocket client connected');

            let currentUserId: string | null = null;
            let isHandshakeComplete = false;

            // Set up handshake timeout
            const handshakeTimeout = setTimeout(() => {
                if (!isHandshakeComplete) {
                    log.warn({ function: 'startServer.onConnection' }, 'Handshake timeout - closing connection');
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Handshake timeout - connection must complete handshake within 10 seconds'
                    }));
                    ws.close(1008, 'Handshake timeout');
                }
            }, 10000);

            ws.on('message', async (messageBuffer: Buffer) => {
                try {
                    const received = messageBuffer.toString();
                    const timestamp = new Date().toISOString();
                    
                    log.info({ 
                        function: 'server.onMessage', 
                        userId: currentUserId || 'unauth',
                        messageLength: received.length,
                        timestamp,
                        rawMessage: received 
                    }, 'Received WebSocket message');

                    let parsedData: unknown;
                    try {
                        parsedData = JSON.parse(received);
                        log.debug({ 
                            function: 'server.onMessage', 
                            userId: currentUserId || 'unauth',
                            parsedMessage: parsedData,
                            messageType: (parsedData as { type?: string })?.type || 'unknown'
                        }, 'Message parsed successfully');
                    } catch (parseError) {
                        log.error({ 
                            function: 'startServer.onMessage', 
                            userId: currentUserId || 'unauth',
                            received, 
                            error: parseError 
                        }, 'Could not parse message as JSON');
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format' }));
                        return;
                    }

                    // Validate message structure
                    if (!isValidMessage(parsedData)) {
                        log.error({ 
                            function: 'startServer.onMessage', 
                            userId: currentUserId || 'unauth',
                            received, 
                            parsedData 
                        }, 'Invalid message structure - message failed validation');
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message structure' }));
                        return;
                    }

                    const parsedMessage = parsedData;
                    log.debug({ 
                        function: 'server.onMessage', 
                        userId: currentUserId || 'unauth',
                        messageType: parsedMessage.type,
                        validatedMessage: parsedMessage 
                    }, 'Message validated successfully');

                    // Handle connection handshake
                    if (isConnectMessage(parsedMessage)) {
                        log.info({ 
                            function: 'server.onMessage', 
                            messageType: 'connect',
                            userId: currentUserId || 'unauth',
                            requestedChannels: parsedMessage.config.channels,
                            isHandshakeComplete 
                        }, 'Processing connection handshake message');

                        if (isHandshakeComplete) {
                            log.warn({ function: 'startServer.onMessage', userId: currentUserId }, 'Handshake already completed');
                            ws.send(JSON.stringify({ type: 'error', message: 'Already connected' }));
                            return;
                        }

                        const { config } = parsedMessage;

                        // For now, use a simple user ID (in production, this would come from authentication)
                        currentUserId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;

                        // Add user to connection manager
                        services.userManager.addUserConnection(currentUserId, ws);

                        // Subscribe user to requested channels
                        for (const channelId of config.channels) {
                            services.channelManager.addUserToChannel(channelId, currentUserId);
                            await services.subscriberService.subscribeTo(channelId);
                        }

                        isHandshakeComplete = true;
                        clearTimeout(handshakeTimeout); // Clear the handshake timeout

                        log.info({
                            function: 'startServer.onConnect',
                            userId: currentUserId,
                            channels: config.channels
                        }, 'User connected and subscribed to channels');

                        ws.send(JSON.stringify({
                            type: 'connected',
                            userId: currentUserId,
                            channels: config.channels
                        }));

                        return;
                    }

                    // Ensure handshake is complete before processing messages
                    if (!isHandshakeComplete || !currentUserId) {
                        log.warn({ function: 'startServer.onMessage' }, 'Message received before handshake completion');
                        ws.send(JSON.stringify({ type: 'error', message: 'Must complete handshake first' }));
                        return;
                    }

                    // Handle chat messages
                    if (isChatMessage(parsedMessage)) {
                        const { message } = parsedMessage;
                        const { channelId, content } = message;
                        
                        log.info({ 
                            function: 'server.onMessage', 
                            messageType: 'chat',
                            userId: currentUserId,
                            channelId,
                            contentLength: content.length,
                            contentPreview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
                            fullMessage: message
                        }, 'Processing chat message');

                        // Verify user is subscribed to channel
                        const channelUsers = services.channelManager.getUsersInChannel(channelId);
                        log.debug({ 
                            function: 'server.onMessage',
                            userId: currentUserId,
                            channelId,
                            channelUsers,
                            userSubscribed: channelUsers.includes(currentUserId)
                        }, 'Checking channel subscription');

                        if (!channelUsers.includes(currentUserId)) {
                            log.warn({
                                function: 'startServer.onMessage',
                                userId: currentUserId,
                                channelId,
                                availableChannels: services.channelManager.getChannels()
                            }, 'User not subscribed to channel');
                            ws.send(JSON.stringify({ type: 'error', message: 'Not subscribed to channel' }));
                            return;
                        }

                        // Save message to Cassandra
                        log.debug({ 
                            function: 'server.onMessage', 
                            userId: currentUserId,
                            channelId 
                        }, 'Saving message to Cassandra...');
                        
                        const savedMessage = await services.messageService.saveMessage(channelId, currentUserId, content);

                        log.info({
                            function: 'startServer.onMessage',
                            messageId: savedMessage.messageId,
                            channelId,
                            userId: currentUserId,
                            contentLength: content.length,
                            createdAt: savedMessage.createdAt,
                            savedMessage: savedMessage
                        }, 'Message saved to database successfully');

                        // Broadcast message through Redis pub/sub
                        log.debug({ 
                            function: 'server.onMessage', 
                            messageId: savedMessage.messageId,
                            channelId 
                        }, 'Publishing message to Redis...');
                        
                        await services.broadcastService.publish(savedMessage);

                        log.info({
                            function: 'startServer.onMessage',
                            messageId: savedMessage.messageId,
                            channelId,
                            publishedAt: new Date().toISOString()
                        }, 'Message published to Redis successfully');

                    } else {
                        // This should never happen due to isValidMessage check, but we need exhaustive checking
                        log.warn({ function: 'startServer.onMessage', receivedMessage: received }, 'Unknown message type received');
                        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
                    }

                } catch (error) {
                    log.error({ function: 'startServer.onMessage', error }, 'Error processing message');
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message' }));
                }
            });

            ws.on('close', (code: number, reason: Buffer) => {
                clearTimeout(handshakeTimeout); // Clean up timeout on close

                const reasonString = reason.toString();
                log.info({
                    function: 'startServer.onClose',
                    userId: currentUserId,
                    code,
                    reason: reasonString
                }, 'WebSocket connection closed');

                if (currentUserId) {
                    // Remove user from connection manager
                    services.userManager.removeUserConnection(currentUserId, ws);

                    // Remove user from all channels
                    const channels = services.channelManager.getChannels();
                    for (const channelId of channels) {
                        services.channelManager.removeUserFromChannel(channelId, currentUserId);
                    }

                    log.info({ function: 'startServer.onClose', userId: currentUserId }, 'User disconnected and cleaned up');
                }
            });

            ws.on('error', (error: Error) => {
                clearTimeout(handshakeTimeout); // Clean up timeout on error
                log.error({ function: 'startServer.onError', error }, 'Websocket error');

                // Send error details to client if connection is still open
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'WebSocket connection error occurred',
                        details: error.message
                    }));
                }
            });
        });

        wss.on('error', (error: Error) => {
            log.error({ function: 'startServer.onServerError', error }, 'Server error');

            // Notify all connected clients about server error before shutdown
            for (const ws of wss.clients) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Server error occurred, connection will be terminated',
                        details: error.message
                    }));
                }
            }

            this.stop();
        });
    }

    async stop(): Promise<void> {
        log.info({ function: 'stopServer' }, 'Shutting down gracefully...');

        // Close WebSocket server first
        if (wss) {
            for (const ws of wss.clients) {
                ws.terminate();
            }

            await new Promise<void>(resolve => {
                const timeout = setTimeout(() => {
                    log.warn({ function: 'stopServer' }, 'WebSocket server close timed out');
                    resolve();
                }, 5000);

                wss.close(() => {
                    clearTimeout(timeout);
                    log.info({ function: 'stopServer' }, 'WebSocket server closed');
                    resolve();
                });
            });
        }

        // Disconnect services with timeout protection
        try {
            await Promise.race([
                services.disconnect(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Services disconnect timeout')), 5000)
                )
            ]);
            log.info({ function: 'stopServer' }, 'Services disconnected');
        } catch (error) {
            log.error({ function: 'stopServer', error }, 'Services disconnect failed or timed out');
        }

        // Disconnect Cassandra with timeout protection
        try {
            await Promise.race([
                disconnectFromCassandra(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Cassandra disconnect timeout')), 3000)
                )
            ]);
            log.info({ function: 'stopServer' }, 'Cassandra disconnected');
        } catch (error) {
            log.error({ function: 'stopServer', error }, 'Cassandra disconnect failed or timed out');
        }

        log.info({ function: 'stopServer' }, 'Graceful shutdown complete');
    }
}

const server = new ChimeServer();

// Shutdown handling with force kill protection
let sigintCount = 0;

async function handleShutdown(signal: string) {
    sigintCount++;

    if (sigintCount === 1) {
        log.info({ function: 'handleShutdown', signal }, 'Received shutdown signal, starting graceful shutdown...');

        // Set a timeout for graceful shutdown
        const shutdownTimeout = setTimeout(() => {
            log.error({ function: 'handleShutdown' }, 'Graceful shutdown timed out, forcing exit');
            process.exit(1);
        }, 10000); // 10 second timeout

        try {
            await server.stop();
            clearTimeout(shutdownTimeout);
            log.info({ function: 'handleShutdown' }, 'Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            clearTimeout(shutdownTimeout);
            log.error({ function: 'handleShutdown', error }, 'Error during graceful shutdown, forcing exit');
            process.exit(1);
        }
    } else if (sigintCount === 2) {
        log.warn({ function: 'handleShutdown', signal }, 'Second shutdown signal received, forcing immediate exit');
        process.exit(1);
    } else {
        log.error({ function: 'handleShutdown', signal, count: sigintCount }, 'Multiple shutdown signals received, killing process');
        process.kill(process.pid, 'SIGKILL');
    }
}

if (require.main === module) {
    server.start();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
    log.error({ function: 'uncaughtException', error }, 'Uncaught exception, forcing exit');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log.error({ function: 'unhandledRejection', reason, promise }, 'Unhandled rejection, forcing exit');
    process.exit(1);
});
