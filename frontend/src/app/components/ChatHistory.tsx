'use client';

import React from 'react';
import Card from './Card';
import { v4 as uuidv4 } from 'uuid';
import User from '@/models/User';
import { ChimeMessage } from '@/types/Message';

type MessageProps = {
  history?: ChimeMessage[];
};

const ChatHistory: React.FC<MessageProps> = ({ history = [] }) => {
  return (
    <div className="flex flex-col overflow-y-auto justify-end">
      {history.map((msg: ChimeMessage) => (
        <Card
          key={uuidv4()}
          text={msg.content}
          user={new User(msg.userId, msg.userId)}
        />
      ))}
    </div>
  );
};

export default ChatHistory;
