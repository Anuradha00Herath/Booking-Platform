import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

const activeService = {
  id: 'svc-1',
  title: 'Full Car Wash',
  isActive: true,
};

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const validDto: CreateBookingDto = {
  customerName: 'John Smith',
  customerEmail: 'john@example.com',
  customerPhone: '+94771234567',
  serviceId: 'svc-1',
  bookingDate: futureDate,
  bookingTime: '14:30',
};

const mockBooking = {
  id: 'bkg-1',
  ...validDto,
  bookingDate: new Date(`${futureDate}T00:00:00.000Z`),
  status: BookingStatus.PENDING,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('BookingsService', () => {
  let bookingsService: BookingsService;

  const prismaMock = {
    service: { findUnique: jest.fn() },
    booking: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [BookingsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    bookingsService = moduleRef.get(BookingsService);
  });

  describe('create', () => {
    it('creates a booking for an existing active service', async () => {
      prismaMock.service.findUnique.mockResolvedValue(activeService);
      prismaMock.booking.findFirst.mockResolvedValue(null);
      prismaMock.booking.create.mockResolvedValue(mockBooking);

      const result = await bookingsService.create(validDto);

      expect(result).toEqual(mockBooking);
    });

    it('throws NotFoundException when the service does not exist', async () => {
      prismaMock.service.findUnique.mockResolvedValue(null);

      await expect(bookingsService.create(validDto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the service is inactive', async () => {
      prismaMock.service.findUnique.mockResolvedValue({ ...activeService, isActive: false });

      await expect(bookingsService.create(validDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the booking date is in the past', async () => {
      prismaMock.service.findUnique.mockResolvedValue(activeService);

      await expect(
        bookingsService.create({ ...validDto, bookingDate: '2020-01-01' }),
      ).rejects.toThrow('Booking date and time cannot be in the past');
    });

    it('throws ConflictException for a duplicate service/date/time booking', async () => {
      prismaMock.service.findUnique.mockResolvedValue(activeService);
      prismaMock.booking.findFirst.mockResolvedValue(mockBooking);

      await expect(bookingsService.create(validDto)).rejects.toThrow(ConflictException);
      expect(prismaMock.booking.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a concurrent request wins the race for the same slot', async () => {
      // Simulates two requests both passing the findFirst pre-check, then
      // racing to insert: the DB's partial unique index rejects the loser
      // with P2002, which should surface as the same friendly 409.
      prismaMock.service.findUnique.mockResolvedValue(activeService);
      prismaMock.booking.findFirst.mockResolvedValue(null);
      prismaMock.booking.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );

      await expect(bookingsService.create(validDto)).rejects.toThrow(ConflictException);
    });

    it('rethrows non-P2002 errors from booking creation', async () => {
      prismaMock.service.findUnique.mockResolvedValue(activeService);
      prismaMock.booking.findFirst.mockResolvedValue(null);
      const unrelatedError = new Error('connection lost');
      prismaMock.booking.create.mockRejectedValue(unrelatedError);

      await expect(bookingsService.create(validDto)).rejects.toThrow('connection lost');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when booking does not exist', async () => {
      prismaMock.booking.findUnique.mockResolvedValue(null);

      await expect(bookingsService.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('updates the status of a booking', async () => {
      prismaMock.booking.findUnique.mockResolvedValue(mockBooking);
      prismaMock.booking.update.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      });

      const result = await bookingsService.updateStatus('bkg-1', BookingStatus.CONFIRMED);

      expect(result.status).toBe(BookingStatus.CONFIRMED);
    });

    it('rejects marking a cancelled booking as completed', async () => {
      prismaMock.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      });

      await expect(
        bookingsService.updateStatus('bkg-1', BookingStatus.COMPLETED),
      ).rejects.toThrow('A cancelled booking cannot be marked as completed');
      expect(prismaMock.booking.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('cancels a pending booking', async () => {
      prismaMock.booking.findUnique.mockResolvedValue(mockBooking);
      prismaMock.booking.update.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      });

      const result = await bookingsService.cancel('bkg-1');

      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    it('rejects cancelling a completed booking', async () => {
      prismaMock.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.COMPLETED,
      });

      await expect(bookingsService.cancel('bkg-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects cancelling an already cancelled booking', async () => {
      prismaMock.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      });

      await expect(bookingsService.cancel('bkg-1')).rejects.toThrow(
        'This booking is already cancelled',
      );
    });
  });
});
