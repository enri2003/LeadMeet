import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpsertNoteDto {
  @IsUUID()
  userId: string;

  @IsDateString()
  date: string; // 'YYYY-MM-DD'

  @IsString()
  @IsNotEmpty()
  content: string;
}
