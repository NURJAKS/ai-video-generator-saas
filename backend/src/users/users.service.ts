import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.findById(userId);
    const { passwordHash, ...profile } = user;
    return profile;
  }

  async updateDisplayName(userId: string, displayName: string): Promise<Partial<User>> {
    await this.userRepo.update(userId, { displayName });
    return this.getProfile(userId);
  }
}
