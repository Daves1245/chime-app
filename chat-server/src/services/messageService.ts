import { getCassandraClient } from '@/database/cassandra';
import { ChimeMessage } from '@/types/message';
import { MessageIDService } from '@/services/messageIDService';
import logger from '@/logger';

const log = logger.child({ module: 'messageService' });

export class MessageService {
    private dbClient = getCassandraClient();
    private messageIDService: MessageIDService;

    constructor(test: boolean = false) {
        this.messageIDService = new MessageIDService(test);
    }

    async connect(): Promise<void> {
        await this.messageIDService.connect();
        log.info({ function: 'connect' }, 'MessageService connected');
    }

    async disconnect(): Promise<void> {
        await this.messageIDService.disconnect();
        log.info({ function: 'disconnect' }, 'MessageService disconnected');
    }

    async getNextMessageId(channelId: string): Promise<number> {
        log.debug({ function: 'getNextMessageId', channelId }, 'Getting next message ID');
        return await this.messageIDService.getNextMessageId(channelId);
    }

    async saveMessage(channelId: string, userId: string, content: string): Promise<ChimeMessage> {
        log.debug({ function: 'saveMessage', channelId, userId }, 'Saving message');

        // Generate new message id (channel specific) using Redis atomic increment
        const messageId: number = await this.messageIDService.getNextMessageId(channelId);
        const createdAt = new Date();

        const query = `
            INSERT INTO messages (channel_id, message_id, user_id, content, created_at, edited_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        /*
         * TODO metadata could contain information such as
         * if a message is a reply to another, the type of media
         * if it has one (photo, video, audio, etc.)
         */

        try {
            await this.dbClient.execute(query, [
                channelId,
                messageId.toString(),
                userId,
                content,
                createdAt,
                null, // edited_at starts as null
                {} // empty metadata map
            ], { prepare: true });

            log.info({ function: 'saveMessage', messageId: messageId.toString(), channelId, userId }, 'Message saved successfully');
        } catch (error) {
            log.error({ function: 'saveMessage', error, channelId, userId }, 'Failed to save message');
            throw error;
        }

        return {
            channelId,
            messageId: messageId.toString(),
            userId,
            content,
            createdAt: createdAt.toISOString(),
            editedAt: null,
            metadata: {}
        };
    }

    async broadcast(_message: ChimeMessage) {

    }
}
