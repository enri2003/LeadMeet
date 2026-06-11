export interface RoomParticipant {
  socketId: string;
  userId: string;
  name: string;
  role: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isActiveSpeaker: boolean;
  stream?: MediaStream;
}

export interface ChatMessage {
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export interface RoomStatePayload {
  participants: Omit<RoomParticipant, 'isActiveSpeaker' | 'stream'>[];
  isHost: boolean;
  roomId: string;
}
