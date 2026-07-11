import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';

const mockService = {
  id: 'svc-1',
  title: 'Full Car Wash',
  description: 'Exterior and interior cleaning',
  duration: 60,
  price: 49.99,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ServicesService', () => {
  let servicesService: ServicesService;

  const prismaMock = {
    service: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ServicesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    servicesService = moduleRef.get(ServicesService);
  });

  describe('create', () => {
    it('creates a service', async () => {
      prismaMock.service.create.mockResolvedValue(mockService);

      const result = await servicesService.create({
        title: mockService.title,
        description: mockService.description,
        duration: mockService.duration,
        price: mockService.price,
      });

      expect(result).toEqual(mockService);
      expect(prismaMock.service.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('returns paginated services with meta', async () => {
      prismaMock.$transaction.mockResolvedValue([[mockService], 11]);

      const result = await servicesService.findAll({ page: 2, limit: 5 });

      expect(result.data).toEqual([mockService]);
      expect(result.meta).toEqual({ total: 11, page: 2, limit: 5, totalPages: 3 });
    });
  });

  describe('findOne', () => {
    it('returns a service when it exists', async () => {
      prismaMock.service.findUnique.mockResolvedValue(mockService);

      await expect(servicesService.findOne('svc-1')).resolves.toEqual(mockService);
    });

    it('throws NotFoundException when service does not exist', async () => {
      prismaMock.service.findUnique.mockResolvedValue(null);

      await expect(servicesService.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates an existing service', async () => {
      prismaMock.service.findUnique.mockResolvedValue(mockService);
      prismaMock.service.update.mockResolvedValue({ ...mockService, title: 'New title' });

      const result = await servicesService.update('svc-1', { title: 'New title' });

      expect(result.title).toBe('New title');
    });

    it('throws NotFoundException when updating a missing service', async () => {
      prismaMock.service.findUnique.mockResolvedValue(null);

      await expect(servicesService.update('missing', { title: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.service.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an existing service', async () => {
      prismaMock.service.findUnique.mockResolvedValue(mockService);
      prismaMock.service.delete.mockResolvedValue(mockService);

      await servicesService.remove('svc-1');

      expect(prismaMock.service.delete).toHaveBeenCalledWith({ where: { id: 'svc-1' } });
    });
  });
});
