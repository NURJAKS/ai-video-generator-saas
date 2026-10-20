import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreditsService } from './credits.service';
import { User } from '../users/entities/user.entity';
import { LedgerTransaction, TransactionType } from './entities/ledger-transaction.entity';
import { CreditPackage } from './entities/credit-package.entity';

describe('CreditsService', () => {
  let service: CreditsService;
  let userRepoMock: any;
  let ledgerRepoMock: any;
  let packageRepoMock: any;
  let dataSourceMock: any;

  beforeEach(async () => {
    userRepoMock = {
      findOne: jest.fn(),
    };
    ledgerRepoMock = {
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    packageRepoMock = {
      findOne: jest.fn(),
    };
    dataSourceMock = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditsService,
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: getRepositoryToken(LedgerTransaction), useValue: ledgerRepoMock },
        { provide: getRepositoryToken(CreditPackage), useValue: packageRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<CreditsService>(CreditsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBalance', () => {
    it('should return the credit balance of an existing user', async () => {
      userRepoMock.findOne.mockResolvedValue({ id: 'u1', creditBalance: 150 });
      const balance = await service.getBalance('u1');
      expect(balance).toBe(150);
      expect(userRepoMock.findOne).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      userRepoMock.findOne.mockResolvedValue(null);
      await expect(service.getBalance('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deductCredits', () => {
    it('should throw BadRequestException when user has insufficient credits', async () => {
      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 'u1', creditBalance: 10 }),
        }),
      };
      dataSourceMock.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(service.deductCredits('u1', 50, 'Video Render Job')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should deduct credits and record a ledger outflow transaction when balance is sufficient', async () => {
      const mockUser = { id: 'u1', creditBalance: 100 };
      const createdTx = {
        id: 'tx1',
        userId: 'u1',
        type: TransactionType.DEDUCTION,
        amount: -30,
        balanceBefore: 100,
        balanceAfter: 70,
      };

      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        }),
        create: jest.fn().mockReturnValue(createdTx),
        save: jest.fn().mockResolvedValue(createdTx),
        update: jest.fn().mockResolvedValue(undefined),
      };
      dataSourceMock.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.deductCredits('u1', 30, 'Video Render Job', 'gen-123');
      expect(result).toEqual(createdTx);
      expect(mockManager.create).toHaveBeenCalledWith(
        LedgerTransaction,
        expect.objectContaining({
          userId: 'u1',
          videoGenerationId: 'gen-123',
          type: TransactionType.DEDUCTION,
          amount: -30,
          balanceBefore: 100,
          balanceAfter: 70,
        }),
      );
      expect(mockManager.update).toHaveBeenCalledWith(User, 'u1', { creditBalance: 70 });
    });
  });

  describe('refundCredits', () => {
    it('should refund credits and record a ledger inflow transaction on generation failure', async () => {
      const mockUser = { id: 'u1', creditBalance: 70 };
      const createdTx = {
        id: 'tx2',
        userId: 'u1',
        type: TransactionType.REFUND,
        amount: 30,
        balanceBefore: 70,
        balanceAfter: 100,
      };

      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockUser),
        }),
        create: jest.fn().mockReturnValue(createdTx),
        save: jest.fn().mockResolvedValue(createdTx),
        update: jest.fn().mockResolvedValue(undefined),
      };
      dataSourceMock.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.refundCredits('u1', 30, 'gen-123', 'FFmpeg rendering timeout');
      expect(result).toEqual(createdTx);
      expect(mockManager.create).toHaveBeenCalledWith(
        LedgerTransaction,
        expect.objectContaining({
          userId: 'u1',
          videoGenerationId: 'gen-123',
          type: TransactionType.REFUND,
          amount: 30,
          balanceBefore: 70,
          balanceAfter: 100,
        }),
      );
      expect(mockManager.update).toHaveBeenCalledWith(User, 'u1', { creditBalance: 100 });
    });
  });
});
