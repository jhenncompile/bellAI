import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send } from 'lucide-react-native';
import { ChatMessage, SuggestionPill } from '@/entities/chat/model/types';
import { componentSizes } from '@/shared/theme/tokens/spacing';
import { useKeyboardVisible } from '@/shared/lib/useKeyboardVisible';
import { Banner, Chip } from '@/shared/ui';
import { Appear, CoralLink, Mascot, coralFonts, coralShadow, coralText, useCoral } from '@/shared/ui/coral';

interface ChatAdvisorViewProps {
  messages: ChatMessage[];
  inputText: string;
  onChangeInput: (text: string) => void;
  onSend: (text?: string) => void;
  suggestions: SuggestionPill[];
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  onPressReason?: (message: ChatMessage) => void;
}

/** Id del saludo inicial que arma `useChatAdvisor`. */
const WELCOME_ID = 'init-1';

/** Burbuja del chat (P1): la asesora en tarjeta blanca; la usuaria en tinta con texto blanco. */
function Bubble({ message, onPressReason }: { message: ChatMessage; onPressReason?: (m: ChatMessage) => void }) {
  const c = useCoral();
  const isUser = message.sender === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.end : styles.start]}>
      <View
        accessible={!onPressReason || isUser || message.id === WELCOME_ID}
        accessibilityLabel={`${isUser ? 'Tú' : 'Asesora BellAI'}, ${message.timestamp}: ${message.text}`}
        style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: c.primary }]
            : [styles.assistantBubble, { backgroundColor: c.card }, coralShadow(c, 4, 14, 0.1)],
        ]}
      >
        {!isUser ? (
          <Text style={[coralText.caption, { fontFamily: coralFonts.extrabold, color: c.ink2 }]}>Asesora BellAI</Text>
        ) : null}
        <Text selectable style={[coralText.body, { fontSize: 15.5, lineHeight: 22, color: isUser ? c.onPrimary : c.ink }]}>
          {message.text}
        </Text>
        {!isUser && onPressReason && message.id !== WELCOME_ID ? (
          <CoralLink
            title="¿Por qué me lo recomienda?"
            underline
            onPress={() => onPressReason(message)}
            accessibilityLabel="Ver por qué te hace esta recomendación"
            style={styles.reason}
          />
        ) : null}
        <Text style={[styles.time, { color: isUser ? c.onPrimary : c.ink2 }, isUser && styles.timeUser]}>{message.timestamp}</Text>
      </View>
    </View>
  );
}

export const ChatAdvisorView: React.FC<ChatAdvisorViewProps> = ({
  messages,
  inputText,
  onChangeInput,
  onSend,
  suggestions,
  isLoading = false,
  error,
  onRetry,
  onPressReason,
}) => {
  const c = useCoral();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const followMessages = useRef(true);
  const send = (text?: string) => {
    followMessages.current = true;
    onSend(text);
  };
  const canSend = Boolean(inputText.trim()) && !isLoading;
  // Con el teclado abierto la barra de pestañas se oculta: el campo queda justo sobre el teclado.
  const bottomGap = keyboardVisible ? 8 : insets.bottom + componentSizes.tabBarFootprint;
  // Conversación sin empezar: solo está el saludo inicial.
  const isEmpty = messages.every((m) => m.id === WELCOME_ID) && !isLoading && !error;

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        scrollEventThrottle={100}
        onScroll={({ nativeEvent: e }) => {
          followMessages.current =
            e.contentSize.height - e.layoutMeasurement.height - e.contentOffset.y < 80;
        }}
        onContentSizeChange={() => {
          if (followMessages.current) scroll.current?.scrollToEnd({ animated: true });
        }}
      >
        {isEmpty ? (
          <View style={styles.empty}>
            <Mascot pose="conversando" height={keyboardVisible ? 90 : 150} enter="pop" />
          </View>
        ) : null}
        {messages.map((message) => (
          <Bubble key={message.id} message={message} onPressReason={onPressReason} />
        ))}
        {isEmpty && suggestions.length ? (
          <Appear delay={150} style={styles.emptySuggestions}>
            <Text accessibilityRole="header" style={[coralText.label, { color: c.ink }]}>Puedes empezar por aquí</Text>
            <View style={styles.wrap}>
              {suggestions.slice(0, 4).map((pill) => (
                <Chip key={pill.id} label={pill.label} accessibilityLabel={`Preguntar: ${pill.label}`} onPress={() => send(pill.prompt)} />
              ))}
            </View>
          </Appear>
        ) : null}
        {isLoading ? (
          <View style={styles.start} accessibilityLiveRegion="polite">
            <View
              accessible
              accessibilityLabel="La asesora está escribiendo"
              style={[styles.typing, { backgroundColor: c.card }, coralShadow(c, 4, 14, 0.1)]}
            >
              <ActivityIndicator size="small" color={c.ink2} />
              <Text style={[coralText.small, { color: c.ink2 }]}>Escribiendo…</Text>
            </View>
          </View>
        ) : null}
        {error ? (
          <View style={styles.error}>
            <Banner
              kind="error"
              title="No se envió tu mensaje"
              description={error}
              actionLabel={onRetry ? 'Reintentar' : undefined}
              onAction={onRetry}
            />
          </View>
        ) : null}
      </ScrollView>

      {!isEmpty && !keyboardVisible && suggestions.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.pills}
          style={styles.pillsBar}
        >
          {suggestions.map((pill) => (
            <Chip
              key={pill.id}
              label={pill.label}
              accessibilityLabel={`Preguntar: ${pill.label}`}
              disabled={isLoading}
              onPress={() => send(pill.prompt)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.composer, { paddingBottom: bottomGap }]}>
        <TextInput
          value={inputText}
          onChangeText={onChangeInput}
          accessibilityLabel="Escribe tu pregunta para la asesora"
          placeholder="Pregunta sobre tus prendas, colores o estilo"
          placeholderTextColor={c.placeholder}
          style={[styles.input, { backgroundColor: c.field, borderColor: c.fieldStroke, color: c.ink }]}
          onSubmitEditing={() => { if (canSend) send(); }}
          returnKeyType="send"
          submitBehavior="submit"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={() => send()}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: c.primary, opacity: canSend ? (pressed ? 0.8 : 1) : 0.35 },
          ]}
        >
          <Send size={19} color={c.onPrimary} strokeWidth={2.3} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  messages: { paddingTop: 4, paddingBottom: 16, flexGrow: 1, gap: 10 },
  bubbleRow: { width: '100%' },
  start: { alignItems: 'flex-start' },
  end: { alignItems: 'flex-end' },
  bubble: { maxWidth: '86%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 22, gap: 4 },
  userBubble: { borderBottomRightRadius: 6 },
  assistantBubble: { borderBottomLeftRadius: 6 },
  reason: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  time: { fontFamily: coralFonts.semibold, fontSize: 11, lineHeight: 14, alignSelf: 'flex-end', opacity: 0.8 },
  timeUser: { opacity: 0.75 },
  empty: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  emptySuggestions: { gap: 10, marginTop: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 40, borderRadius: 20, borderBottomLeftRadius: 6 },
  error: { marginTop: 4 },
  pillsBar: { flexGrow: 0, marginHorizontal: -16 },
  pills: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  composer: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    fontFamily: coralFonts.semibold,
    fontSize: 16,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
