import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() micDeviceId?: string;
  @IsOptional() @IsString() audioOutId?: string;
  @IsOptional() @IsBoolean() noiseCancel?: boolean;
  @IsOptional() @IsBoolean() faceLink?: boolean;

  @IsOptional()
  @IsIn(['organization', 'anyone', 'verified'])
  privacyLevel?: string;

  @IsOptional() @IsBoolean() hidePresence?: boolean;

  @IsOptional() @IsNumber() @Min(12) @Max(24) fontSize?: number;

  @IsOptional()
  @IsIn(['dark-lead', 'light-lead'])
  theme?: string;

  @IsOptional() @IsBoolean() captions?: boolean;

  @IsOptional()
  @IsIn(['es', 'en', 'pt', 'fr'])
  captionLang?: string;
}
