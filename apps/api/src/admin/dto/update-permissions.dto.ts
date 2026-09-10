import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { PermissionGrantDto } from './create-freelancer-account.dto';

// A-005f — editing an existing freelancer/moderator account's module grants after creation.
export class UpdatePermissionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PermissionGrantDto)
  permissions!: PermissionGrantDto[];
}
