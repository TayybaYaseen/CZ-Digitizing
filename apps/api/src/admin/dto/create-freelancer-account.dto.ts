import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEmail, IsEnum, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { AdminAccessLevel, AdminModule } from '../../generated/prisma';

export class PermissionGrantDto {
  @IsEnum(AdminModule)
  module!: AdminModule;

  @IsEnum(AdminAccessLevel)
  accessLevel!: AdminAccessLevel;
}

// AC-8 — role is limited to freelancer/moderator; role=admin/customer are never created here.
export class CreateFreelancerAccountDto {
  @IsEmail()
  email!: string;

  @IsIn(['freelancer', 'moderator'])
  role!: 'freelancer' | 'moderator';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PermissionGrantDto)
  permissions!: PermissionGrantDto[];
}
