import { IsInt, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminTopUpDto {
  @ApiProperty({ description: 'Number of credits to add', example: 100 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Admin note for this top-up', example: 'Promotional bonus' })
  @IsString()
  @MinLength(3)
  note: string;
}
