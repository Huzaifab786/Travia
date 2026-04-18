import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { View, Text, TextInput, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { AuthContext } from '../../../app/providers/AuthProvider';
import { jwtDecode } from "jwt-decode";
import { ENV } from '../../../config/env';
import { getSocket } from '../../../services/socket';
import { spacing, typography, radius } from '../../../config/theme';

export function ChatScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { rideId } = route.params as { rideId: string };
  const { token, user } = useContext(AuthContext);
  const { theme, isDark } = useTheme();
  const backendUserId = token
    ? (() => {
        try {
          const decoded = jwtDecode<{ userId?: string }>(token);
          return decoded.userId ?? null;
        } catch {
          return null;
        }
      })()
    : null;

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleIncomingMessage = useCallback((msg: any) => {
    setMessages((prev) => {
      if (msg?.clientMessageId) {
        const matchedIndex = prev.findIndex(
          (item) => item.clientMessageId === msg.clientMessageId,
        );
        if (matchedIndex >= 0) {
          const next = [...prev];
          next[matchedIndex] = msg;
          return next;
        }
      }

      if (prev.some((item) => item.id === msg.id)) {
        return prev;
      }
      return [...prev, msg];
    });
  }, []);

  useEffect(() => {
    fetchMessages();

    const socket = getSocket();
    const syncConnection = () => setIsConnected(Boolean(socket?.connected));

    if (socket) {
      syncConnection();
      socket.emit('join_ride', rideId);
      socket.on('connect', syncConnection);
      socket.on('disconnect', syncConnection);
      socket.on('new_message', handleIncomingMessage);
    }

    return () => {
      if (socket) {
        socket.emit('leave_ride', rideId);
        socket.off('connect', syncConnection);
        socket.off('disconnect', syncConnection);
        socket.off('new_message', handleIncomingMessage);
      }
    };
  }, [rideId, handleIncomingMessage]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${ENV.API_BASE_URL}/api/rides/${rideId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const { data } = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.log('Error fetching messages', e);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const clientMessageId = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const content = inputText.trim();
    const optimisticMessage = {
      id: clientMessageId,
      clientMessageId,
      senderId: backendUserId,
      sender: user
        ? { id: user.id, name: user.user_metadata?.full_name || "You" }
        : undefined,
      content,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText("");
    setIsSending(true);
    const socket = getSocket();

    const fallbackToHttp = async () => {
      const res = await fetch(`${ENV.API_BASE_URL}/api/rides/${rideId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, clientMessageId }),
      });

      if (!res.ok) {
        throw new Error("Message send failed");
      }

      const { data } = await res.json();
      handleIncomingMessage(data);
    };

    const sendViaSocket = () =>
      new Promise<void>((resolve, reject) => {
        if (!socket || !socket.connected) {
          reject(new Error("Socket unavailable"));
          return;
        }

        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Socket ack timeout"));
          }
        }, 2000);

        socket.emit(
          "send_message",
          { rideId, content, clientMessageId },
          (response: any) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (response?.ok && response.data) {
              handleIncomingMessage(response.data);
              resolve();
            } else {
              reject(new Error(response?.error || "Socket send failed"));
            }
          },
        );
      });

    try {
      if (socket?.connected) {
        await sendViaSocket();
      } else {
        await fallbackToHttp();
      }
    } catch (e) {
      try {
        await fallbackToHttp();
      } catch (fallbackError) {
        console.log('Error sending message', fallbackError);
        setMessages((prev) =>
          prev.filter((item) => item.clientMessageId !== clientMessageId),
        );
        setInputText(content);
      }
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMine = item.pending === true || item.senderId === backendUserId;
    return (
      <View style={[styles.messageBubble, isMine ? [styles.myMessage, { backgroundColor: theme.primary }] : [styles.theirMessage, { backgroundColor: isDark ? '#1F2937' : '#E5E7EB' }]]}>
        {!isMine && <Text style={[styles.senderName, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{item.sender?.name}</Text>}
        <Text style={[styles.messageText, { color: isMine ? '#FFFFFF' : theme.textPrimary }]}>{item.content}</Text>
        <Text style={[styles.timeText, { color: isMine ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
          {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </Text>
      </View>
    );
  };

  const styles = makeStyles(theme, isDark);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Ride Chat</Text>
          <Text style={[styles.headerSubtitle, { color: isConnected ? theme.success : theme.textSecondary }]}>
            {isConnected ? 'Live connection ready' : 'Reconnecting...'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputContainer, { borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.surface }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={sendMessage}
            editable={!isSending}
          />
          <Pressable
            onPress={sendMessage}
            style={[
              styles.sendButton,
              { backgroundColor: theme.primary, opacity: isSending ? 0.75 : 1 },
            ]}
          >
            <Ionicons name={isSending ? "time-outline" : "send"} size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(theme: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: spacing.sm,
    },
    headerTitle: {
      ...typography.h3,
    },
    headerSubtitle: {
      ...typography.caption,
      marginTop: 2,
    },
    listContent: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    messageBubble: {
      maxWidth: '80%',
      padding: spacing.md,
      borderRadius: radius.lg,
    },
    myMessage: {
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
    },
    theirMessage: {
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
    },
    senderName: {
      ...typography.label,
      fontSize: 11,
      marginBottom: 2,
    },
    messageText: {
      ...typography.body,
    },
    timeText: {
      ...typography.caption,
      marginTop: 4,
      alignSelf: "flex-end",
    },
    inputContainer: {
      flexDirection: 'row',
      padding: spacing.md,
      borderTopWidth: 1,
      alignItems: 'center',
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      ...typography.body,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
