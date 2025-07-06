class ChannelManager {
    private channels = new Map<string, Set<string>>(); // channelId => userIds

    addUserToChannel(channelId: string, userId: string): void {
        if (!this.channels.has(channelId)) {
            this.channels.set(channelId, new Set());
        }
        this.channels.get(channelId)!.add(userId);
    }

    removeUserFromChannel(channelId: string, userId: string): void {
        const users = this.channels.get(channelId);
        if (users) {
            users.delete(userId);
            if (users.size === 0) {
                this.channels.delete(channelId);
            }
        }
    }

    getUsersInChannel(channelId: string): string[] {
        return Array.from(this.channels.get(channelId) || []);
    }

    getChannels(): string[] {
        return Array.from(this.channels.keys());
    }
}

export default ChannelManager;
