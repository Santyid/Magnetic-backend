import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { AdvocatesConnector } from './connectors/advocates.connector';
import { ConnectProductDto } from '../products/dto/connect-product.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private productsService: ProductsService,
    private advocatesConnector: AdvocatesConnector,
  ) {}

  async connectProduct(userId: string, userProductId: string, dto: ConnectProductDto) {
    const userProducts = await this.productsService.findUserProducts(userId);
    const up = userProducts.find((p) => p.id === userProductId);

    if (!up) {
      throw new NotFoundException('PRODUCT_NOT_FOUND');
    }

    const slug = up.product.slug;

    // Validate credentials against the product API
    if (slug === 'advocates') {
      const subdomain = dto.subdomain || up.customDomain?.split('.')[0] || 'qa';

      try {
        await this.advocatesConnector.authenticate(
          dto.productEmail,
          dto.password,
          subdomain,
        );
      } catch {
        throw new BadRequestException('INVALID_PRODUCT_CREDENTIALS');
      }

      // Credentials are valid — save them encrypted
      await this.productsService.saveCredentials(userProductId, {
        productEmail: dto.productEmail,
        password: dto.password,
        enableMetrics: true,
      });

      // Update customDomain if subdomain was provided
      if (dto.subdomain) {
        await this.productsService.updateProductAssignment(userProductId, {
          customDomain: `${dto.subdomain}.advocatespro.com`,
        });
      }

      return {
        connected: true,
        message: 'PRODUCT_CONNECTED_SUCCESSFULLY',
        product: {
          name: up.product.name,
          slug: up.product.slug,
        },
      };
    }

    // Other products — not implemented yet, just save credentials
    await this.productsService.saveCredentials(userProductId, {
      productEmail: dto.productEmail,
      password: dto.password,
      apiToken: dto.apiToken,
      enableMetrics: false,
    });

    return {
      connected: true,
      message: 'CREDENTIALS_SAVED',
      product: {
        name: up.product.name,
        slug: up.product.slug,
      },
    };
  }

  async disconnectProduct(userId: string, userProductId: string) {
    const userProducts = await this.productsService.findUserProducts(userId);
    const up = userProducts.find((p) => p.id === userProductId);

    if (!up) {
      throw new NotFoundException('PRODUCT_NOT_FOUND');
    }

    await this.productsService.deleteCredentials(userProductId);

    return {
      connected: false,
      message: 'PRODUCT_DISCONNECTED_SUCCESSFULLY',
      product: {
        name: up.product.name,
        slug: up.product.slug,
      },
    };
  }

  async getMetrics(userId: string) {
    const userProducts = await this.productsService.findUserProducts(userId);
    const metricsEnabled = userProducts.filter(
      (up) => up.enableMetrics && up.encryptedPassword,
    );

    const results: Array<{
      productSlug: string;
      productName: string;
      metrics?: Record<string, any>;
      error?: string;
    }> = [];

    for (const up of metricsEnabled) {
      const slug = up.product.slug;

      if (slug === 'advocates') {
        try {
          const creds = this.productsService.getDecryptedCredentials(up);
          if (!creds.password || !creds.productEmail) {
            results.push({
              productSlug: slug,
              productName: up.product.name,
              error: 'MISSING_CREDENTIALS',
            });
            continue;
          }

          // Extract subdomain from customDomain (e.g., "qa.advocatespro.com" -> "qa")
          const subdomain = up.customDomain?.split('.')[0] || 'qa';

          const auth = await this.advocatesConnector.authenticate(
            creds.productEmail,
            creds.password,
            subdomain,
          );

          const metrics = await this.advocatesConnector.getMetrics(auth.token);

          results.push({
            productSlug: slug,
            productName: up.product.name,
            metrics,
          });
        } catch (error) {
          this.logger.error(`Advocates metrics error: ${error.message}`);
          results.push({
            productSlug: slug,
            productName: up.product.name,
            error: error.message,
          });
        }
      } else {
        // Other products not implemented yet
        results.push({
          productSlug: slug,
          productName: up.product.name,
          error: 'CONNECTOR_NOT_IMPLEMENTED',
        });
      }
    }

    return { metrics: results };
  }

  async syncProduct(userId: string, userProductId: string) {
    const userProducts = await this.productsService.findUserProducts(userId);
    const up = userProducts.find(
      (p) => p.id === userProductId && p.enableMetrics,
    );

    if (!up) {
      return { error: 'PRODUCT_NOT_FOUND_OR_METRICS_DISABLED' };
    }

    if (up.product.slug === 'advocates') {
      const creds = this.productsService.getDecryptedCredentials(up);
      if (!creds.password || !creds.productEmail) {
        return { error: 'MISSING_CREDENTIALS' };
      }

      const subdomain = up.customDomain?.split('.')[0] || 'qa';
      const auth = await this.advocatesConnector.authenticate(
        creds.productEmail,
        creds.password,
        subdomain,
      );
      const metrics = await this.advocatesConnector.getMetrics(auth.token);

      return {
        productSlug: up.product.slug,
        productName: up.product.name,
        metrics,
      };
    }

    return { error: 'CONNECTOR_NOT_IMPLEMENTED' };
  }
}
