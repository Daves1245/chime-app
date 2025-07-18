import { ConnectConfig } from './ConnectConfig';

export interface ChimeMessage {
    channelId: string;
    channelName?: string; // Add optional channel name
    messageId: string;
    userId: string;
    content: string;
    createdAt: string;
    editedAt: string | null;
    metadata: Record<string, unknown>;
}

export type Message =
    { type: 'message', message: ChimeMessage | ClientMessageInput } |
    { type: 'connect', config: ConnectConfig } |
    { type: 'connected', userId: string, channels: string[] } |
    { type: 'error', message: string, details?: string };

export function isValidChimeMessage(message: unknown): message is ChimeMessage {
    if (!message || typeof message !== 'object') {
        return false;
    }

    const msg = message as Record<string, unknown>;
    return !!(
        msg.channelId &&
        msg.messageId &&
        msg.userId &&
        msg.content &&
        msg.createdAt
    );
}

/**
 * Client message input - minimal required fields from client
 */
export interface ClientMessageInput {
    channelId: string;
    content: string;
}

/**
 * Validates client message input (minimal message from client)
 */
export function isValidClientMessageInput(message: unknown): message is ClientMessageInput {
    if (!message || typeof message !== 'object') {
        return false;
    }

    const msg = message as Record<string, unknown>;
    return !!(
        msg.channelId &&
        typeof msg.channelId === 'string' &&
        msg.content &&
        typeof msg.content === 'string'
    );
}

export function validateChimeMessage(message: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!message || typeof message !== 'object') {
        errors.push('Message is not an object');
        return { valid: false, errors };
    }

    const msg = message as Record<string, unknown>;
    if (!msg.channelId) errors.push('Missing channelId');
    if (!msg.messageId) errors.push('Missing messageId');
    if (!msg.userId) errors.push('Missing userId');
    if (!msg.content) errors.push('Missing content');
    if (!msg.createdAt) errors.push('Missing createdAt');

    return { valid: errors.length === 0, errors };
}

/**
 * Parses raw WebSocket data into a Message
 */
export function parseMessage(rawData: string): Message {
    try {
        const parsed = JSON.parse(rawData);

        if (!isValidMessageStructure(parsed)) {
            throw new Error('Invalid message structure');
        }

        return parsed as Message;
    } catch (error) {
        throw new Error(`Message parsing failed: ${error}`);
    }
}

/**
 * Validates the basic structure of a message object
 */
export function isValidMessageStructure(data: unknown): boolean {
    if (!data || typeof data !== 'object' || !('type' in data)) {
        return false;
    }

    const validTypes = ['message', 'connect', 'connected', 'error'];
    return validTypes.includes((data as { type: string }).type);
}

/**
 * Comprehensive message validation
 */
export function validateMessage(message: Message): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (message.type) {
    case 'message': {
        // Check if it's a full ChimeMessage or client input
        if (isValidChimeMessage(message.message)) {
            const chimeValidation = validateChimeMessage(message.message);
            if (!chimeValidation.valid) {
                errors.push(...chimeValidation.errors);
            }
        } else if (isValidClientMessageInput(message.message)) {
            // Client input is valid - no additional validation needed
        } else {
            errors.push('Invalid message: must be either a complete ChimeMessage or valid client input');
        }
        break;
    }
    case 'connect':
        if (!isValidConnectConfig(message.config)) {
            errors.push('Invalid connect configuration');
        }
        break;
    case 'connected':
        if (!message.userId) errors.push('Missing userId in connected response');
        if (!Array.isArray(message.channels)) errors.push('Invalid channels array in connected response');
        break;
    case 'error':
        if (!message.message) errors.push('Missing error message');
        break;
    default:
        errors.push('Unknown message type');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Type guard for Message validation
 */
export function isValidMessage(message: unknown): message is Message {
    if (!isValidMessageStructure(message)) {
        return false;
    }

    const validation = validateMessage(message as Message);
    return validation.valid;
}

export function isValidConnectConfig(config: ConnectConfig): boolean {
    return config && Array.isArray(config.channels) && config.channels.length > 0;
}

/**
 * Type guard for connect messages
 */
export function isConnectMessage(message: Message): message is { type: 'connect', config: ConnectConfig } {
    return message.type === 'connect' && 'config' in message && isValidConnectConfig(message.config);
}

/**
 * Type guard for chat messages (handles both full ChimeMessage and client input)
 */
export function isChatMessage(message: Message): message is { type: 'message', message: ChimeMessage | ClientMessageInput } {
    return message.type === 'message' && 'message' in message && 
           (isValidChimeMessage(message.message) || isValidClientMessageInput(message.message));
}
