import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /** POST /api/auth/company/login — client companies and their sub-accounts */
  @Post('company/login')
  @HttpCode(200)
  companyLogin(@Body() dto: LoginDto) {
    return this.authService.loginCompany(dto);
  }

  /** POST /api/auth/admin/login — IGTS back-office */
  @Post('admin/login')
  @HttpCode(200)
  adminLogin(@Body() dto: LoginDto) {
    return this.authService.loginAdmin(dto);
  }

  /** GET /api/auth/profile */
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user);
  }
}
