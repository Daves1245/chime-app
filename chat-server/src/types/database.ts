import { types } from 'cassandra-driver';

/**
 * Interface representing a message row from Cassandra
 */
export interface MessageRow {
    channel_id: string;
    message_id: string;
    user_id: string;
    content: string;
    created_at: Date;
    edited_at: Date | null;
    metadata: Map<string, string>;
}

/**
 * Type guard to check if a Cassandra row is a valid MessageRow
 */
export function isMessageRow(row: types.Row): row is types.Row & MessageRow {
    return (
        typeof row.channel_id === 'string' &&
        typeof row.message_id === 'string' &&
        typeof row.user_id === 'string' &&
        typeof row.content === 'string' &&
        row.created_at instanceof Date
    );
}

/**
 * Safely converts a Cassandra Row to MessageRow with validation
 */
export function toMessageRow(row: types.Row): MessageRow | null {
    if (!isMessageRow(row)) {
        return null;
    }

    return {
        channel_id: row.channel_id,
        message_id: row.message_id,
        user_id: row.user_id,
        content: row.content,
        created_at: row.created_at,
        edited_at: row.edited_at || null,
        metadata: row.metadata || new Map()
    };
}

/**
 * Type for Cassandra query results containing message rows
 */
export interface MessageQueryResult {
    rows: types.Row[];
    first(): types.Row | null;
    rowLength: number;
}

/**
 * Helper function to find a message by content with proper typing
 */
export function findMessageByContent(result: MessageQueryResult, content: string): MessageRow | null {
    const row = result.rows.find((row: types.Row) => 
        typeof row.content === 'string' && row.content === content
    );
    
    return row ? toMessageRow(row) : null;
}