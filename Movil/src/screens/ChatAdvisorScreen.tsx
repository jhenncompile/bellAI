import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Clock, Plus, Sparkles } from 'lucide-react-native';
import { Chip } from '@/shared/ui';
import { CoralScreen, CoralTitle, coralFonts, coralText, useCoral } from '@/shared/ui/coral';
import { ChatAdvisorView } from '@/widgets/ChatAdvisorView/ui/ChatAdvisorView';
import { useChatAdvisor } from '@/features/chat-advisor/model/useChatAdvisor';
import { useKeyboardVisible } from '@/shared/lib/useKeyboardVisible';
import { RecommendationReasonModal } from '@/widgets/RecommendationReason/RecommendationReasonModal';
import { HistoryModal } from '@/widgets/History/HistoryModal';

/** Asistente BellAI (pestaña /advisor): chat con la asesora que usa tus datos activos. */
export const ChatAdvisorScreen: React.FC = () => {
  const c = useCoral();
  const keyboardVisible = useKeyboardVisible();
  const [showHistory, setShowHistory] = useState(false);

  const {
    messages,
    inputText,
    setInputText,
    isLoading,
    suggestions,
    sendMessage,
    error,
    retryMessage,
    activeContextSummary,
    startNewConversation,
    resumeConversation,
    reasonModalState,
    openReasonForMessage,
    closeReasonModal,
  } = useChatAdvisor();

  return (
    <CoralScreen scrollable={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <CoralTitle prefix="Asistente " accent="BellAI" size={30} />
        {/* Con el teclado abierto se esconde lo secundario para dejar sitio a la conversación. */}
        {!keyboardVisible ? (
          <>
            <View style={styles.actions}>
              <Chip
                label="Mi historial"
                icon={<Clock size={16} color={c.ink} />}
                accessibilityLabel="Abrir mi historial de análisis, combinaciones y consultas"
                onPress={() => setShowHistory(true)}
              />
              <Chip
                label="Nueva consulta"
                icon={<Plus size={16} color={c.ink} />}
                accessibilityLabel="Empezar una consulta nueva con la asesora"
                onPress={startNewConversation}
              />
            </View>
            {activeContextSummary ? (
              <View style={[styles.context, { backgroundColor: c.muted }]}>
                <Sparkles size={16} color={c.ink} strokeWidth={2.2} />
                <Text numberOfLines={2} style={[coralText.caption, styles.flex, { fontSize: 13, color: c.ink2 }]}>
                  <Text style={{ fontFamily: coralFonts.extrabold, color: c.ink }}>Tus datos activos: </Text>
                  {activeContextSummary}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={styles.flex}>
        <ChatAdvisorView
          messages={messages}
          inputText={inputText}
          onChangeInput={setInputText}
          onSend={sendMessage}
          suggestions={suggestions}
          isLoading={isLoading}
          error={error}
          onRetry={retryMessage}
          onPressReason={openReasonForMessage}
        />
      </View>

      <RecommendationReasonModal
        visible={reasonModalState.visible}
        onClose={closeReasonModal}
        recommendationTitle={reasonModalState.title}
        reasonSummary={reasonModalState.reasonSummary}
        consideredFactors={reasonModalState.consideredFactors}
        contextSummary={activeContextSummary}
      />

      <HistoryModal
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        onResumeConsultation={resumeConversation}
      />
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  // El hueco inferior para la barra de pestañas lo gestiona el chat (cambia con el teclado).
  screen: { paddingBottom: 0 },
  header: { gap: 12, paddingBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  context: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  flex: { flex: 1 },
});
