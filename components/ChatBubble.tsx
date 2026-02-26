import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp: string;
}

export default function ChatBubble({ message, isUser, timestamp }: ChatBubbleProps) {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      marginVertical: 4,
      paddingHorizontal: 16,
    },
    userContainer: {
      alignItems: 'flex-end',
    },
    aiContainer: {
      alignItems: 'flex-start',
    },
    bubble: {
      maxWidth: '80%',
      padding: 12,
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
      fontSize: 16,
      lineHeight: 20,
    },
    userMessage: {
      color: '#FFFFFF',
    },
    aiMessage: {
      color: colors.textPrimary,
    },
    timestamp: {
      fontSize: 12,
      marginTop: 4,
    },
    userTimestamp: {
      color: 'rgba(255,255,255,0.7)',
    },
    aiTimestamp: {
      color: colors.textSecondary,
    },
  });

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
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