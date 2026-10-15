import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PurchaseCreditsDto {
  @ApiProperty({ description: 'UUID of the credit package to purchase' })
  @IsUUID()
  packageId: string;
}
