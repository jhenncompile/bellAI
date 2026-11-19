import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BellaiModule } from '../bellai/bellai.module';
import { StyleModule } from '../style/style.module';
import { OutfitsModule } from '../outfits/outfits.module';
import { AssistantController, LegacyConversationController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { LlmService } from './llm.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  // OutfitsModule: el asistente pide combinaciones reales al motor (herramienta proponer_outfits)
  imports: [AdminModule, BellaiModule, StyleModule, OutfitsModule, SubscriptionsModule],
  controllers: [AssistantController, LegacyConversationController],
  providers: [AssistantService, LlmService],
  exports: [AssistantService, LlmService],
})
export class AssistantModule {}
