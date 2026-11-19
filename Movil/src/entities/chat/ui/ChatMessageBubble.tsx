import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { ChatMessage } from '../model/types';
import { useTheme, ThemeColors, typography, spacing, radius } from '@/shared/theme';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onPressReason?: (message: ChatMessage) => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  onPressReason,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const isUser = message.sender === 'user';

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        {!isUser && (
          <Text style={[typography.caption, styles.assistantHeader]}>
            Asesora BellAI
          </Text>
        )}
        <Text
          selectable
          style={[
            typography.bodyMedium,
            styles.text,
            isUser && { color: colors.text.inverse },
          ]}
        >
          {message.text}
        </Text>

        {!isUser && onPressReason && message.id !== 'init-1' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver motivo de recomendaciones"
            onPress={() => onPressReason(message)}
            style={styles.reasonBtn}
          >
            <Sparkles size={14} color={colors.penpot.border.focus} />
            <Text style={[typography.captionStrong, styles.reasonBtnText]}>
              Motivo de recomendaciones
            </Text>
          </Pressable>
        ) : null}

        <Text
          style={[
            typography.caption,
            styles.time,
            isUser && { color: colors.text.inverse, opacity: 0.75 },
          ]}
        >
          {message.timestamp}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginVertical: spacing.xs,
      width: '100%',
    },
    userContainer: {
      alignItems: 'flex-end',
    },
    assistantContainer: {
      alignItems: 'flex-start',
    },
    bubble: {
      maxWidth: '86%',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 22,
    },
    userBubble: {
      backgroundColor: colors.brand.primary,
      borderBottomRightRadius: 6,
    },
    assistantBubble: {
      backgroundColor: colors.surface.card,
      borderWidth: 1,
      borderColor: colors.border.glass,
      borderBottomLeftRadius: 6,
    },
    assistantHeader: {
      color: colors.text.secondary,
      marginBottom: 4,
    },
    text: {
      color: colors.text.primary,
    },
    reasonBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      minHeight: 44,
      marginTop: spacing.sm,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.full,
      backgroundColor: colors.brand.accentSoft,
      borderWidth: 1,
      borderColor: colors.penpot.border.focus,
    },
    reasonBtnText: {
      color: colors.penpot.border.focus,
    },
    time: {
      color: colors.text.secondary,
      fontSize: 11,
      alignSelf: 'flex-end',
      marginTop: 4,
    },
  });
