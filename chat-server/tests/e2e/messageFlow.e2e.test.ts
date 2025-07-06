import { WebSocket, WebSocketServer } from 'ws';
import { ServiceContainer } from '@/util/ServiceContainer';
import { connectToCassandra, disconnectFromCassandra, getCassandraClient } from '@/database/cassandra';
import { isValidMessage, isConnectMessage, isChatMessage } from '@/types/message';
import { findMessageByContent, MessageQueryResult } from '@/types/database';
import logger from '@/logger';

const log = logger.child({ module: 'e2e-test' });

// Test configuration
const TEST_PORT = 8080;

class MockWebSocketClient {
    private ws: WebSocket;
    private receivedMessages: string[] = [];
    private isConnected = false;
    private userId: string | null = null;

    constructor(port: number) {
        this.ws = new WebSocket(`ws://localhost:${port}`);
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws.on('open', () => {
                this.isConnected = true;
                resolve();
            });

            this.ws.on('error', (error) => {
                reject(error);
            });

            this.ws.on('message', (data: Buffer) => {
                const message = data.toString();
                this.receivedMessages.push(message);
                log.debug({ function: 'MockClient.onMessage', message }, 'Received message');
                
                // Parse connection response to get userId
                try {
                    const parsed = JSON.parse(message);
                    if (parsed.type === 'connected' && parsed.userId) {
                        this.userId = parsed.userId;
                        log.debug({ function: 'MockClient.onMessage', userId: this.userId }, 'Got user ID from server');
                    }
                } catch {
                    // Not JSON, ignore
                }
            });
        });
    }

    sendHandshake(channels: string[]): void {
        const connectMessage = {
            type: 'connect',
            config: { channels }
        };
        this.ws.send(JSON.stringify(connectMessage));
        log.debug({ function: 'MockClient.sendHandshake', channels }, 'Sent handshake');
    }

    sendMessage(channelId: string, content: string): void {
        const message = {
            type: 'message',
            message: {
                channelId,
                content
            }
        };
        this.ws.send(JSON.stringify(message));
        log.debug({ function: 'MockClient.sendMessage', channelId, content }, 'Sent message');
    }

    waitForMessage(timeout = 5000): Promise<string> {
        return new Promise((resolve, reject) => {
            const startLength = this.receivedMessages.length;
            const checkForMessage = () => {
                if (this.receivedMessages.length > startLength) {
                    resolve(this.receivedMessages[this.receivedMessages.length - 1]);
                    return true;
                }
                return false;
            };

            // Check immediately in case message already arrived
            if (checkForMessage()) {
                return;
            }

            const interval = setInterval(() => {
                if (checkForMessage()) {
                    clearInterval(interval);
                }
            }, 10);

            setTimeout(() => {
                clearInterval(interval);
                reject(new Error('Timeout waiting for message'));
            }, timeout);
        });
    }

    waitForConnectionResponse(timeout = 5000): Promise<string> {
        return new Promise((resolve, reject) => {
            const checkForConnection = () => {
                // Look for a connection response message
                const connectionMsg = this.receivedMessages.find(msg => {
                    try {
                        const parsed = JSON.parse(msg);
                        return parsed.type === 'connected';
                    } catch {
                        return false;
                    }
                });
                if (connectionMsg) {
                    resolve(connectionMsg);
                    return true;
                }
                return false;
            };

            // Check immediately in case message already arrived
            if (checkForConnection()) {
                return;
            }

            const interval = setInterval(() => {
                if (checkForConnection()) {
                    clearInterval(interval);
                }
            }, 10);

            setTimeout(() => {
                clearInterval(interval);
                reject(new Error('Timeout waiting for connection response'));
            }, timeout);
        });
    }

    getReceivedMessages(): string[] {
        return [...this.receivedMessages];
    }

    getUserId(): string | null {
        return this.userId;
    }

    close(): void {
        this.ws.close();
    }
}

describe('End-to-End Message Flow Tests', () => {
    let server: WebSocketServer;
    let services: ServiceContainer;
    let cassandraClient: ReturnType<typeof getCassandraClient>;

    // Test clients
    let client1: MockWebSocketClient;
    let client2: MockWebSocketClient;
    let client3: MockWebSocketClient;

    beforeAll(async () => {
        // Connect to test services
        await connectToCassandra();
        cassandraClient = getCassandraClient();
        
        // Initialize services with test flag
        services = new ServiceContainer(true);
        await services.connect();

        // Set up message routing from Redis to WebSocket clients
        // This mimics what the real server should do - listen for Redis messages and forward them
        
        // Ensure MessageSubscriberService is fully connected and ready
        log.info({ function: 'e2e-test.setup' }, 'Waiting for MessageSubscriberService to be fully ready...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Give Redis pub/sub time to initialize
        
        // Test that the subscriber service can subscribe to a test channel
        try {
            await services.subscriberService.subscribeTo('test-connection-check');
            log.info({ function: 'e2e-test.setup' }, 'MessageSubscriberService connection verified');
        } catch (error) {
            log.error({ function: 'e2e-test.setup', error }, 'Failed to verify MessageSubscriberService connection');
            throw error;
        }
        
        // Start WebSocket server
        server = new WebSocketServer({ port: TEST_PORT });

        server.on('connection', (ws: WebSocket) => {
            log.info({ function: 'e2e-test.onConnection' }, 'Test client connected');
            
            let currentUserId: string | null = null;
            let isHandshakeComplete = false;

            ws.on('message', async (messageBuffer: Buffer) => {
                try {
                    const received = messageBuffer.toString();
                    log.debug({ function: 'e2e-test.onMessage', received }, 'Received message');

                    let parsedData: unknown;
                    try {
                        parsedData = JSON.parse(received);
                    } catch {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format' }));
                        return;
                    }

                    // Validate message structure
                    if (!isValidMessage(parsedData)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message structure' }));
                        return;
                    }

                    const message = parsedData;

                    // Handle connection handshake
                    if (isConnectMessage(message)) {
                        if (isHandshakeComplete) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Already connected' }));
                            return;
                        }

                        const { config } = message;
                        
                        // Generate test user ID
                        currentUserId = `test_user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                        
                        // Add user to services
                        services.userManager.addUserConnection(currentUserId, ws);
                        
                        // Subscribe to channels  
                        for (const channelId of config.channels) {
                            services.channelManager.addUserToChannel(channelId, currentUserId);
                            // Only subscribe to Redis channel if not already subscribed
                            // (MessageSubscriberService will handle broadcasting automatically)
                            try {
                                await services.subscriberService.subscribeTo(channelId);
                            } catch (error) {
                                // Ignore if already subscribed
                                log.debug({ function: 'e2e-test.subscribe', channelId, error }, 'Channel subscription issue (likely already subscribed)');
                            }
                        }
                        
                        isHandshakeComplete = true;
                        
                        log.info({ 
                            function: 'e2e-test.onConnect', 
                            userId: currentUserId, 
                            channels: config.channels 
                        }, 'Test user connected');
                        
                        ws.send(JSON.stringify({ 
                            type: 'connected', 
                            userId: currentUserId, 
                            channels: config.channels 
                        }));
                        
                        return;
                    }

                    // Handle chat messages
                    if (isChatMessage(message) && isHandshakeComplete && currentUserId) {
                        const { message: messageData } = message;
                        const { channelId, content } = messageData;
                        
                        // Verify user is subscribed to channel
                        const channelUsers = services.channelManager.getUsersInChannel(channelId);
                        if (!channelUsers.includes(currentUserId)) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Not subscribed to channel' }));
                            return;
                        }

                        // Save message to Cassandra
                        const savedMessage = await services.messageService.saveMessage(channelId, currentUserId, content);
                        
                        log.info({ 
                            function: 'e2e-test.onMessage', 
                            messageId: savedMessage.messageId, 
                            channelId, 
                            userId: currentUserId 
                        }, 'Test message saved');

                        // Broadcast message through Redis
                        await services.broadcastService.publish(savedMessage);
                        
                        log.debug({ 
                            function: 'e2e-test.onMessage', 
                            messageId: savedMessage.messageId, 
                            channelId 
                        }, 'Test message published to Redis');
                    }

                } catch (error) {
                    log.error({ function: 'e2e-test.onMessage', error }, 'Error processing test message');
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message' }));
                }
            });

            ws.on('close', () => {
                if (currentUserId) {
                    services.userManager.removeUserConnection(currentUserId, ws);
                    const channels = services.channelManager.getChannels();
                    for (const channelId of channels) {
                        services.channelManager.removeUserFromChannel(channelId, currentUserId);
                    }
                    log.info({ function: 'e2e-test.onClose', userId: currentUserId }, 'Test user disconnected');
                }
            });
        });

        // Wait for server to start
        await new Promise<void>((resolve) => {
            server.on('listening', () => {
                log.info({ function: 'e2e-test.setup', port: TEST_PORT }, 'Test WebSocket server started');
                resolve();
            });
        });
    }, 30000);

    afterAll(async () => {
        // Close all clients
        if (client1) client1.close();
        if (client2) client2.close();
        if (client3) client3.close();

        // Stop server and services
        server.close();
        await services.disconnect();
        await disconnectFromCassandra();
        
        log.info({ function: 'e2e-test.teardown' }, 'Test cleanup completed');
    }, 15000);

    beforeEach(() => {
        // Clear any existing test data
        jest.clearAllMocks();
    });

    test('should handle complete message flow between multiple clients', async () => {
        // Create and connect clients
        client1 = new MockWebSocketClient(TEST_PORT);
        client2 = new MockWebSocketClient(TEST_PORT);
        client3 = new MockWebSocketClient(TEST_PORT);

        await Promise.all([
            client1.connect(),
            client2.connect(),
            client3.connect()
        ]);

        // Send handshake for all clients
        client1.sendHandshake(['general', 'random']);
        client2.sendHandshake(['general']);
        client3.sendHandshake(['random']);

        // Wait for connection confirmations using the specific method
        const conn1 = await client1.waitForConnectionResponse();
        const conn2 = await client2.waitForConnectionResponse();
        const conn3 = await client3.waitForConnectionResponse();

        // Verify connections
        const parsed1 = JSON.parse(conn1);
        const parsed2 = JSON.parse(conn2);
        const parsed3 = JSON.parse(conn3);

        expect(parsed1.type).toBe('connected');
        expect(parsed1.userId).toBeTruthy();
        expect(parsed1.channels).toEqual(['general', 'random']);

        expect(parsed2.type).toBe('connected');
        expect(parsed2.userId).toBeTruthy();
        expect(parsed2.channels).toEqual(['general']);

        expect(parsed3.type).toBe('connected');
        expect(parsed3.userId).toBeTruthy();
        expect(parsed3.channels).toEqual(['random']);

        log.info({ 
            function: 'e2e-test.handshake',
            client1Id: parsed1.userId,
            client2Id: parsed2.userId,
            client3Id: parsed3.userId
        }, 'All clients connected successfully');

        // Give more time for Redis subscriptions to be properly set up
        log.info({ function: 'e2e-test.setup' }, 'Waiting for Redis subscriptions to be fully established...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Extended wait for Redis pub/sub
        
        // Debug: Check what users are in each channel
        log.info({
            function: 'e2e-test.debug',
            generalUsers: services.channelManager.getUsersInChannel('general'),
            randomUsers: services.channelManager.getUsersInChannel('random'),
            allUsers: services.userManager.getAllConnectedUsers()
        }, 'Channel and user state before sending message');

        // Client 1 sends message to 'general' channel
        client1.sendMessage('general', 'Hello from client 1 to general!');

        // Wait longer for message to be processed through Redis pub/sub and delivered
        log.info({ function: 'e2e-test.messaging' }, 'Waiting for message to be processed and delivered...');
        await new Promise(resolve => setTimeout(resolve, 4000)); // Extended wait for message delivery

        const client2Messages = client2.getReceivedMessages();
        const client3Messages = client3.getReceivedMessages();

        log.info({
            function: 'e2e-test.messaging',
            client2MessageCount: client2Messages.length,
            client2Messages: client2Messages,
            client3MessageCount: client3Messages.length,
            client3Messages: client3Messages
        }, 'Message counts after sending to general channel');

        // Client 2 should have connection message + the broadcast message
        expect(client2Messages.length).toBeGreaterThan(1);
        
        // Check if client 2 received the wrapped Message
        const hasGeneralMessage = client2Messages.some(msg => {
            try {
                const parsed = JSON.parse(msg);
                // MessageSubscriberService sends wrapped Message objects
                return parsed.type === 'message' &&
                       parsed.message &&
                       parsed.message.channelId === 'general' && 
                       parsed.message.content && 
                       parsed.message.content.includes('Hello from client 1 to general!');
            } catch {
                return false;
            }
        });
        expect(hasGeneralMessage).toBe(true);

        // Client 3 should only have connection message (not subscribed to general)
        expect(client3Messages.length).toBe(1); // Only connection message

        // Client 3 sends message to 'random' channel
        client3.sendMessage('random', 'Hello from client 3 to random!');

        // Wait for the random channel message to be processed and delivered
        log.info({ function: 'e2e-test.messaging' }, 'Waiting for random channel message to be delivered...');
        await new Promise(resolve => setTimeout(resolve, 4000)); // Extended wait

        const client1Messages = client1.getReceivedMessages();
        const client2MessagesAfter = client2.getReceivedMessages();

        // Check if client 1 received the wrapped Message for random channel
        const hasRandomMessage = client1Messages.some(msg => {
            try {
                const parsed = JSON.parse(msg);
                // MessageSubscriberService sends wrapped Message objects
                return parsed.type === 'message' &&
                       parsed.message &&
                       parsed.message.channelId === 'random' && 
                       parsed.message.content && 
                       parsed.message.content.includes('Hello from client 3 to random!');
            } catch {
                return false;
            }
        });
        expect(hasRandomMessage).toBe(true);

        // Client 2 should not have received the random message
        expect(client2MessagesAfter.length).toBe(client2Messages.length);

        log.info({ function: 'e2e-test.messaging' }, 'Message routing between clients verified');

    }, 35000); // Increased timeout to account for longer waits

    test('should persist messages to Cassandra', async () => {
        // Create and connect a client
        const testClient = new MockWebSocketClient(TEST_PORT);
        await testClient.connect();

        // Send handshake
        testClient.sendHandshake(['test-persistence']);
        await testClient.waitForMessage(); // Wait for connection confirmation

        // Give time for subscriptions
        await new Promise(resolve => setTimeout(resolve, 500));

        // Send a test message
        const testContent = `Test message for persistence ${Date.now()}`;
        testClient.sendMessage('test-persistence', testContent);

        // Wait for message to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Query Cassandra to verify message was saved
        const query = 'SELECT * FROM messages WHERE channel_id = ? ALLOW FILTERING';
        const result = await cassandraClient.execute(query, ['test-persistence'], { prepare: true }) as MessageQueryResult;

        log.info({
            function: 'e2e-test.persistence',
            rowCount: result.rows.length,
            testContent,
            allMessages: result.rows.map(row => ({ content: row.content, messageId: row.message_id }))
        }, 'Cassandra query results');

        // Find our test message using the helper function
        const savedMessage = findMessageByContent(result, testContent);
        
        log.info({
            function: 'e2e-test.persistence',
            savedMessage,
            searchContent: testContent
        }, 'Message search result');
        
        expect(savedMessage).toBeTruthy();
        expect(savedMessage).not.toBeNull();
        
        if (savedMessage) {
            expect(savedMessage.channel_id).toBe('test-persistence');
            expect(savedMessage.content).toBe(testContent);
            expect(savedMessage.user_id).toBeTruthy();
            expect(savedMessage.message_id).toBeTruthy();
            expect(savedMessage.created_at).toBeTruthy();

            log.info({ 
                function: 'e2e-test.persistence', 
                messageId: savedMessage.message_id,
                content: savedMessage.content 
            }, 'Message persistence to Cassandra verified');
        }

        testClient.close();
    }, 15000);

    test('should handle client disconnection gracefully', async () => {
        // Create clients
        const client4 = new MockWebSocketClient(TEST_PORT);
        const client5 = new MockWebSocketClient(TEST_PORT);

        await Promise.all([client4.connect(), client5.connect()]);

        // Connect both to same channel
        client4.sendHandshake(['disconnect-test']);
        client5.sendHandshake(['disconnect-test']);

        await Promise.all([client4.waitForMessage(), client5.waitForMessage()]);

        // Give time for subscriptions
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify both are in the channel
        const channelUsers = services.channelManager.getUsersInChannel('disconnect-test');
        expect(channelUsers.length).toBe(2);

        // Disconnect client4
        client4.close();

        // Give time for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify client4 was removed from channel
        const remainingUsers = services.channelManager.getUsersInChannel('disconnect-test');
        expect(remainingUsers.length).toBe(1);

        // Client5 should still be able to send messages
        client5.sendMessage('disconnect-test', 'Message after client4 disconnected');

        // Give time for message processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        log.info({ function: 'e2e-test.disconnection' }, 'Client disconnection handling verified');

        client5.close();
    }, 15000);
});