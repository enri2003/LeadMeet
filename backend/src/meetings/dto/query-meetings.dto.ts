import { IsDateString, IsIn, IsOptional } from 'class-validator';

export type MeetingFilterStatus = 'upcoming' | 'live' | 'past' | 'archived';

export class QueryMeetingsDto {
  @IsOptional()
  userId?: string;

  @IsOptional()
  @IsIn(['upcoming', 'live', 'past', 'archived'])
  status?: MeetingFilterStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
