import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerName: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  customerEmail: string;

  @ApiProperty({ example: '+94771234567' })
  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, {
    message: 'customerPhone must be a valid phone number',
  })
  customerPhone: string;

  @ApiProperty({ example: 'a3bb189e-8bf9-3888-9912-ace4e6543002', description: 'Service UUID' })
  @IsUUID()
  serviceId: string;

  @ApiProperty({ example: '2026-08-15', description: 'Booking date (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'bookingDate must be in YYYY-MM-DD format' })
  bookingDate: string;

  @ApiProperty({ example: '14:30', description: 'Booking time (HH:mm, 24h)' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'bookingTime must be in HH:mm (24h) format' })
  bookingTime: string;

  @ApiPropertyOptional({ example: 'Please call before arriving' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
