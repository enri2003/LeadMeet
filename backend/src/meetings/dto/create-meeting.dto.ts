import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['strategy', 'negotiation', 'interview', 'general'])
  type: 'strategy' | 'negotiation' | 'interview' | 'general';

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;

  @IsString()
  userId: string;
}
