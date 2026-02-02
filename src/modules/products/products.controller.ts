import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AssignProductDto } from './dto/assign-product.dto';
import { UpdateProductAssignmentDto } from './dto/update-product-assignment.dto';
import { SaveCredentialsDto } from './dto/save-credentials.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req) {
    return this.productsService.findUserProducts(req.user.userId);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAllProducts() {
    return this.productsService.findAll();
  }

  @Get(':slug/access')
  @UseGuards(JwtAuthGuard)
  async getAccessToken(@Request() req, @Param('slug') slug: string) {
    return this.productsService.generateAccessToken(req.user.userId, slug);
  }

  @Post('assign/:userId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  assignProduct(
    @Param('userId') userId: string,
    @Body() assignProductDto: AssignProductDto,
  ) {
    return this.productsService.assignProductToUser(userId, assignProductDto);
  }

  @Delete(':productId/user/:userId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  removeProduct(
    @Param('userId') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.productsService.removeProductFromUser(userId, productId);
  }

  @Post('credentials/:userProductId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  saveCredentials(
    @Param('userProductId') userProductId: string,
    @Body() saveCredentialsDto: SaveCredentialsDto,
  ) {
    return this.productsService.saveCredentials(
      userProductId,
      saveCredentialsDto,
    );
  }

  @Delete('credentials/:userProductId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  deleteCredentials(@Param('userProductId') userProductId: string) {
    return this.productsService.deleteCredentials(userProductId);
  }

  @Patch('assign/:userProductId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updateProductAssignment(
    @Param('userProductId') userProductId: string,
    @Body() updateProductAssignmentDto: UpdateProductAssignmentDto,
  ) {
    return this.productsService.updateProductAssignment(
      userProductId,
      updateProductAssignmentDto,
    );
  }
}
