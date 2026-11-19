import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      status: 'online',
      service: 'Sistema Bellia Backend API',
      version: '1.0.0',
      database: 'PostgreSQL 17 (bellia)',
      endpoints: {
        auth: '/api/auth',
        wardrobe: '/api/wardrobe',
        profile: '/api/profile',
        media: '/api/media',
        admin: '/api/admin',
      },
    };
  }

  @Get('api')
  getApi() {
    return this.getRoot();
  }
}
