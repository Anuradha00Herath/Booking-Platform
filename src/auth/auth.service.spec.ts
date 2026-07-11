import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const mockUser = {
  id: 'user-1',
  email: 'jane@example.com',
  password: 'hashed-password',
  name: 'Jane Doe',
  refreshToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let authService: AuthService;

  const usersServiceMock = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    setRefreshToken: jest.fn(),
  };

  const jwtServiceMock = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    verifyAsync: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn((_key: string, def?: string) => def),
    getOrThrow: jest.fn(() => 'secret'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtServiceMock.signAsync.mockResolvedValue('signed-token');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('registers a new user and returns tokens', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);
      usersServiceMock.create.mockResolvedValue(mockUser);

      const result = await authService.register({
        email: mockUser.email,
        password: 'StrongPass123',
        name: mockUser.name,
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
      // password must be hashed before persisting
      const createdWith = usersServiceMock.create.mock.calls[0][0];
      expect(createdWith.password).not.toBe('StrongPass123');
    });

    it('throws ConflictException when email is already registered', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.register({ email: mockUser.email, password: 'x'.repeat(8), name: 'Jane' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const hashed = await bcrypt.hash('StrongPass123', 4);
      usersServiceMock.findByEmail.mockResolvedValue({ ...mockUser, password: hashed });

      const result = await authService.login({
        email: mockUser.email,
        password: 'StrongPass123',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(usersServiceMock.setRefreshToken).toHaveBeenCalled();
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nobody@example.com', password: 'whatever1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      const hashed = await bcrypt.hash('CorrectPassword1', 4);
      usersServiceMock.findByEmail.mockResolvedValue({ ...mockUser, password: hashed });

      await expect(
        authService.login({ email: mockUser.email, password: 'WrongPassword1' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('throws UnauthorizedException for an invalid refresh token', async () => {
      jwtServiceMock.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(authService.refreshTokens('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('issues new tokens for a valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const hashedToken = await bcrypt.hash(refreshToken, 4);
      jwtServiceMock.verifyAsync.mockResolvedValue({ sub: mockUser.id, email: mockUser.email });
      usersServiceMock.findById.mockResolvedValue({ ...mockUser, refreshToken: hashedToken });

      const result = await authService.refreshTokens(refreshToken);

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
    });
  });

  describe('logout', () => {
    it('clears the stored refresh token', async () => {
      await authService.logout(mockUser.id);

      expect(usersServiceMock.setRefreshToken).toHaveBeenCalledWith(mockUser.id, null);
    });
  });
});
