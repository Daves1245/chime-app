import { MessageService } from '@/services/messageService';
import { MessageBroadcastService } from '@/services/messageBroadcaseService';
import { UserConnectionManager } from '@/util/UserConnectionManager';
import ChannelManager from '@/util/ChannelManager';
import { MessageSubscriberService } from '@/services/messageSubscriberService';
import logger from '@/logger';

const log = logger.child({ module: 'serviceContainer' });

export interface IServiceContainer {
    messageService: MessageService;
    broadcastService: MessageBroadcastService;
    userManager: UserConnectionManager;
    channelManager: ChannelManager;
    subscriberService: MessageSubscriberService;
}

export class ServiceContainer implements IServiceContainer {
    public readonly messageService: MessageService;
    public readonly broadcastService: MessageBroadcastService;
    public readonly userManager: UserConnectionManager;
    public readonly channelManager: ChannelManager;
    public readonly subscriberService: MessageSubscriberService;

    constructor(test: boolean = false) {
        log.debug({ function: 'constructor', test }, 'Creating ServiceContainer');

        // Create individual services
        this.messageService = new MessageService(test);
        this.broadcastService = new MessageBroadcastService(test);
        this.userManager = new UserConnectionManager();
        this.channelManager = new ChannelManager();
        
        // MessageSubscriberService needs the managers as dependencies
        this.subscriberService = new MessageSubscriberService(
            this.channelManager,
            this.userManager,
            test
        );

        log.info({ function: 'constructor' }, 'ServiceContainer created successfully');
    }

    async connect(): Promise<void> {
        log.info({ function: 'connect' }, 'Connecting all services');

        try {
            await this.messageService.connect();
            await this.broadcastService.init();
            await this.subscriberService.connect();
            
            log.info({ function: 'connect' }, 'All services connected successfully');
        } catch (error) {
            log.error({ function: 'connect', error }, 'Failed to connect services');
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        log.info({ function: 'disconnect' }, 'Disconnecting all services');

        try {
            await this.subscriberService.disconnect();
            await this.broadcastService.disconnect();
            await this.messageService.disconnect();
            
            log.info({ function: 'disconnect' }, 'All services disconnected successfully');
        } catch (error) {
            log.error({ function: 'disconnect', error }, 'Error during service disconnection');
            throw error;
        }
    }
}