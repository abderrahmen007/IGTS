import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /auth/company/login
   * Login endpoint for company users (the main users of the platform).
   */
  @Post('company/login')
  async companyLogin(@Body() loginDto: LoginDto) {
    return this.authService.validateCompany(loginDto);
  }

  /**
   * POST /auth/admin/login
   * Login endpoint for IGTS admin users.
   */
  @Post('admin/login')
  async adminLogin(@Body() loginDto: LoginDto) {
    return this.authService.validateAdmin(loginDto);
  }

  /**
   * GET /auth/profile
   * Returns the profile of the currently authenticated user.
   * Requires a valid JWT Bearer token.
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id, req.user.type);
  }
}
