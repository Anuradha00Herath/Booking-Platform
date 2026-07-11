import { Injectable, NotFoundException } from '@nestjs/common';
import { Service } from '@prisma/client';
import { PaginatedResult, paginate } from '../common/dto/paginated-result';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateServiceDto): Promise<Service> {
    return this.prisma.service.create({ data: dto });
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<Service>> {
    const { page, limit } = query;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.service.count(),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException(`Service with id "${id}" not found`);
    }
    return service;
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.service.delete({ where: { id } });
  }
}
