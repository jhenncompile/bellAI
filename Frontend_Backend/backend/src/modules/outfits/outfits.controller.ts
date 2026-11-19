import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { OutfitsService } from './outfits.service';
import { OUTFIT_RATINGS, OutfitRating } from './outfit-ratings';
import { CompareOutfitsDto, GenerateOutfitsDto, SaveOutfitDto, UpdateOutfitDto } from './outfits.dto';

@ApiTags('Outfits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/outfits')
export class OutfitsController {
  constructor(private readonly service: OutfitsService) {}

  /** HU-015 / HU-016 / HU-038 */
  @Post('generate')
  @HttpCode(200)
  generate(@CurrentUser() user: User, @Body() dto: GenerateOutfitsDto) {
    return this.service.generate(user, dto);
  }

  /** HU-017 */
  @Post('compare')
  @HttpCode(200)
  compare(@CurrentUser() user: User, @Body() dto: CompareOutfitsDto) {
    return this.service.compare(user, dto);
  }

  /** HU-018: guardar (la valoración se envía a /api/style/feedback con targetType=outfit) */
  @Post()
  save(@CurrentUser() user: User, @Body() dto: SaveOutfitDto) {
    return this.service.save(user, dto);
  }

  @Get()
  list(@CurrentUser() user: User, @Query('favorites') favorites?: string, @Query('rating') rating?: string) {
    // HU-22: consultar las guardadas, filtrando por favoritas o por valoración
    if (rating !== undefined && !(OUTFIT_RATINGS as readonly string[]).includes(rating)) {
      throw new BadRequestException('La valoración debe ser agradable, neutral o no agradable.');
    }
    return this.service.list(user, favorites === undefined ? undefined : favorites === 'true', rating as OutfitRating | undefined);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOutfitDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user, id);
  }

  @Post(':id/wear')
  @HttpCode(200)
  wear(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.wear(user, id);
  }
}
