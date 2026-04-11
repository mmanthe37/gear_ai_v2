import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { sp } from '../theme/spacing';
import { typeScale } from '../theme/typography';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp: string;
}

export default function ChatBubble({ message, isUser, timestamp }: ChatBubbleProps) {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      marginVertical: sp[1],
      paddingHorizontal: sp[4],
    },
    userContainer: {
      alignItems: 'flex-end',
    },
    aiContainer: {
      alignItems: 'flex-start',
    },
    bubble: {
      maxWidth: '80%',
      padding: sp[3],
      borderRadius: 20,
    },
    userBubble: {
      backgroundColor: colors.actionAccent,
      borderBottomRightRadius: 4,
    },
    aiBubble: {
      backgroundColor: colors.surfaceAlt,
      borderBottomLeftRadius: 4,
    },
    message: {
      fontSize: typeScale.md,
      lineHeight: 20,
    },
    userMessage: {
      color: '#FFFFFF',
    },
    aiMessage: {
      color: colors.textPrimary,
    },
    timestamp: {
      fontSize: typeScale.xs,
      marginTop: sp[1],
    },
    userTimestamp: {
      color: 'rgba(255,255,255,0.7)',
    },
    aiTimestamp: {
      color: colors.textSecondary,
    },
  });

  return (
    <View
      style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}
      accessibilityLabel={`${isUser ? 'You' : 'AI'}: ${message.slice(0, 80)}`}
    >
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.message, isUser ? styles.userMessage : styles.aiMessage]}>
          {message}
        </Text>
        <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.aiTimestamp]}>
          {timestamp}
        </Text>
      </View>
    </View>
  );
}