import { Controller, Get, Module, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WeatherService } from './weather.service';

@ApiTags('Clima')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get()
  current(@Query('lat') lat: string, @Query('lon') lon: string) {
    return this.weather.current(Number(lat), Number(lon));
  }
}

@Module({
  controllers: [WeatherController],
  providers: [WeatherService],
  exports: [WeatherService],
})
export class WeatherModule {}
