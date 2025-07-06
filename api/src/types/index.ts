export interface User {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
}

export interface Server {
    id: string;
    name: string;
    ip: string;
    port: number;
    users: string[];
    channels: string[];
}

export interface Channel {
    id: string;
    name: string;
    server_id: string;
}

// TODO how should DMs be handled. special case server between two
// users with only one channel?

export interface Message {
    channelId: string;
    channelName?: string; // Add optional channel name
    messageId: string;
    userId: string;
    content: string;
    createdAt: string;
    editedAt: string | null;
    metadata: Record<string, string>;
}
