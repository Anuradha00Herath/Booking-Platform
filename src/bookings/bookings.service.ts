import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Booking, BookingStatus, Prisma } from '@prisma/client';
import { PaginatedResult, paginate } from '../common/dto/paginated-result';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBookingDto): Promise<Booking> {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) {
      throw new NotFoundException(`Service with id "${dto.serviceId}" not found`);
    }
    if (!service.isActive) {
      throw new BadRequestException('This service is not currently available for booking');
    }

    this.assertNotInPast(dto.bookingDate, dto.bookingTime);

    const bookingDate = new Date(`${dto.bookingDate}T00:00:00.000Z`);

    const duplicate = await this.prisma.booking.findFirst({
      where: {
        serviceId: dto.serviceId,
        bookingDate,
        bookingTime: dto.bookingTime,
        status: { not: BookingStatus.CANCELLED },
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'A booking already exists for this service at the selected date and time',
      );
    }

    // The findFirst check above is a best-effort pre-check, not a guarantee:
    // two concurrent requests for the same slot can both pass it. The DB's
    // partial unique index (bookings_active_slot_key) is the actual source
    // of truth, so the race-condition loser is caught here and turned into
    // the same friendly 409 instead of surfacing as a raw Prisma error.
    try {
      return await this.prisma.booking.create({
        data: {
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          serviceId: dto.serviceId,
          bookingDate,
          bookingTime: dto.bookingTime,
          notes: dto.notes,
        },
        include: { service: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A booking already exists for this service at the selected date and time',
        );
      }
      throw error;
    }
  }

  async findAll(query: QueryBookingsDto): Promise<PaginatedResult<Booking>> {
    const { page, limit, status, search } = query;

    const where: Prisma.BookingWhereInput = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerEmail: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ bookingDate: 'asc' }, { bookingTime: 'asc' }],
        include: { service: true },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { service: true },
    });
    if (!booking) {
      throw new NotFoundException(`Booking with id "${id}" not found`);
    }
    return booking;
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status === BookingStatus.CANCELLED && status === BookingStatus.COMPLETED) {
      throw new BadRequestException('A cancelled booking cannot be marked as completed');
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status },
      include: { service: true },
    });
  }

  async cancel(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('A completed booking cannot be cancelled');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('This booking is already cancelled');
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
      include: { service: true },
    });
  }

  /**
   * Rejects bookings whose date/time is in the past.
   * Date-times are interpreted as UTC (documented assumption).
   */
  private assertNotInPast(date: string, time: string): void {
    const bookingDateTime = new Date(`${date}T${time}:00.000Z`);
    if (Number.isNaN(bookingDateTime.getTime())) {
      throw new BadRequestException('Invalid booking date or time');
    }
    if (bookingDateTime.getTime() < Date.now()) {
      throw new BadRequestException('Booking date and time cannot be in the past');
    }
  }
}
