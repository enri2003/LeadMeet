import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class StartSharingDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;
}

export class StopSharingDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;
}


export class SharingBroadcastDto {
  userId: string;
  userName: string;
  roomId: string;
  timestamp: string;
}
