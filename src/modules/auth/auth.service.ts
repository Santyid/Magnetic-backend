import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private sessionsService: SessionsService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(PasswordResetToken)
    private passwordResetTokenRepository: Repository<PasswordResetToken>,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.create(registerDto);
    const { password, ...result } = user;
    return result;
  }

  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.sessionsService.create(
      user.id,
      accessToken,
      refreshToken,
      expiresAt,
      ipAddress,
      userAgent,
    );

    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });

      const session = await this.sessionsService.findByRefreshToken(
        refreshToken,
      );

      if (!session) {
        throw new UnauthorizedException('Sesión inválida');
      }

      const user = await this.usersService.findOne(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuario no autorizado');
      }

      const newPayload = {
        sub: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      };

      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get('jwt.secret'),
        expiresIn: this.configService.get('jwt.expiresIn'),
      });

      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get('jwt.refreshSecret'),
        expiresIn: this.configService.get('jwt.refreshExpiresIn'),
      });

      await this.sessionsService.deleteByRefreshToken(refreshToken);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await this.sessionsService.create(
        user.id,
        newAccessToken,
        newRefreshToken,
        expiresAt,
        session.ipAddress,
        session.userAgent,
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  async logout(refreshToken: string) {
    await this.sessionsService.deleteByRefreshToken(refreshToken);
    return { message: 'Sesión cerrada exitosamente' };
  }

  async me(userId: string) {
    const user = await this.usersService.findOne(userId);
    const { password, ...result } = user;
    return result;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.findOne(userId);

    const isPasswordValid = await this.usersService.validatePassword(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    await this.usersService.update(userId, { password: newPassword });

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async getUserSessions(userId: string) {
    return this.sessionsService.findByUserId(userId);
  }

  async logoutAll(userId: string, currentRefreshToken: string) {
    await this.sessionsService.deleteAllUserSessions(userId);
    return { message: 'Todas las sesiones han sido cerradas' };
  }

  async deleteSession(sessionId: string, userId: string) {
    const session = await this.sessionsService.findByUserId(userId);
    const userSession = session.find((s) => s.id === sessionId);

    if (!userSession) {
      throw new UnauthorizedException('Sesión no encontrada');
    }

    await this.sessionsService.deleteByRefreshToken(userSession.refreshToken);
    return { message: 'Sesión cerrada exitosamente' };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Por seguridad, no revelamos si el email existe o no
      return {
        message:
          'Si el email existe, recibirás un link para resetear tu contraseña',
      };
    }

    // Invalidar tokens anteriores
    await this.passwordResetTokenRepository.update(
      { userId: user.id, used: false },
      { used: true },
    );

    // Generar token aleatorio
    const token = crypto.randomBytes(32).toString('hex');

    // Guardar token con expiración de 1 hora
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.passwordResetTokenRepository.save({
      userId: user.id,
      token,
      expiresAt,
      used: false,
    });

    // TODO: Enviar email con el link
    // Por ahora, solo logueamos el token (en producción esto sería un email)
    console.log(
      `🔐 Password reset token para ${email}: ${token}`,
    );
    console.log(
      `Link de reseteo: ${this.configService.get('frontendUrl')}/reset-password?token=${token}`,
    );

    return {
      message:
        'Si el email existe, recibirás un link para resetear tu contraseña',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: { token, used: false },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new BadRequestException('Token inválido o expirado');
    }

    // Verificar si el token expiró
    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('Token expirado');
    }

    // Actualizar contraseña
    await this.usersService.update(resetToken.userId, { password: newPassword });

    // Marcar token como usado
    resetToken.used = true;
    await this.passwordResetTokenRepository.save(resetToken);

    // Cerrar todas las sesiones del usuario por seguridad
    await this.sessionsService.deleteAllUserSessions(resetToken.userId);

    return { message: 'Contraseña actualizada exitosamente' };
  }
}
