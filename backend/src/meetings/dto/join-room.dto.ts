import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  roomId: string;

  @IsString()
  userId: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  token?: string;
}
