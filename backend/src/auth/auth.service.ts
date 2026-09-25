import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Validates a company user against the existing database.
   * The old Symfony app used argon2id hashing, which the `argon2` npm package supports natively.
   */
  async validateCompany(loginDto: LoginDto) {
    const company = await this.prisma.company.findUnique({
      where: { email: loginDto.email },
    });

    if (!company) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (!company.enabled || company.deleted) {
      throw new UnauthorizedException('Ce compte est désactivé');
    }

    // Verify the argon2id password from the old Symfony database
    const isPasswordValid = await argon2.verify(
      company.password,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    return this.generateTokens(company);
  }

  /**
   * Validates an admin user (from the `user` table).
   */
  async validateAdmin(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (!user.enabled) {
      throw new UnauthorizedException('Ce compte est désactivé');
    }

    const isPasswordValid = await argon2.verify(
      user.password,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    return this.generateAdminTokens(user);
  }

  private generateTokens(company: any) {
    const roles = JSON.parse(company.roles);
    const payload = {
      sub: company.id,
      email: company.email,
      nom: company.nom,
      raisonsociale: company.raisonsociale,
      roles: roles,
      type: 'company',
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: company.id,
        email: company.email,
        nom: company.nom,
        raisonsociale: company.raisonsociale,
        fonction: company.fonction,
        image: company.tmpphoto,
        roles: roles,
        multicompte: company.multicompte,
      },
    };
  }

  private generateAdminTokens(user: any) {
    const roles = JSON.parse(user.roles);
    const payload = {
      sub: user.id,
      email: user.email,
      nom: user.nom,
      roles: roles,
      type: 'admin',
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        image: user.image,
        roles: roles,
      },
    };
  }

  /**
   * Returns the profile of the currently authenticated user.
   */
  async getProfile(userId: number, userType: string) {
    if (userType === 'admin') {
      return this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          image: true,
          roles: true,
        },
      });
    }

    return this.prisma.company.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nom: true,
        raisonsociale: true,
        fonction: true,
        image: true,
        tmpphoto: true,
        roles: true,
        multicompte: true,
        tel: true,
        adresse: true,
        ville: true,
      },
    });
  }
}
