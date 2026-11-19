import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BellaiModule } from '../bellai/bellai.module';
import { StyleModule } from '../style/style.module';
import { WeatherModule } from '../weather/weather.module';
import { OutfitsController } from './outfits.controller';
import { OutfitsService } from './outfits.service';

@Module({
  imports: [AdminModule, BellaiModule, StyleModule, WeatherModule],
  controllers: [OutfitsController],
  providers: [OutfitsService],
  exports: [OutfitsService],
})
export class OutfitsModule {}
