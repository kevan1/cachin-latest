import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Colors } from '@/constants/theme';

type ExportResultMessage = {
  status?: 'success' | 'error';
  error?: string;
};

type WebViewErrorPayload = {
  nativeEvent?: {
    description?: string;
    title?: string;
  };
};

function parseExportResult(raw: string): ExportResultMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as ExportResultMessage;
  } catch {
    return null;
  }
}

export default function ExportWebViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { url } = useLocalSearchParams<{ url?: string | string[] }>();

  const exportUrl = useMemo(() => {
    const raw = Array.isArray(url) ? url[0] : url;
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [url]);

  const closeScreen = useCallback(() => {
    router.back();
  }, [router]);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const parsed = parseExportResult(event.nativeEvent.data);
      if (!parsed?.status) return;

      if (parsed.status === 'success') {
        Alert.alert('Export complete', 'Private key export finished successfully.', [
          { text: 'Done', onPress: closeScreen },
        ]);
        return;
      }

      Alert.alert('Export failed', parsed.error?.trim() || 'The export page returned an error.', [
        { text: 'Close', onPress: closeScreen },
      ]);
    },
    [closeScreen]
  );

  const handleWebViewError = useCallback(
    (event: WebViewErrorPayload) => {
      const message =
        event.nativeEvent?.description?.trim() ||
        event.nativeEvent?.title?.trim() ||
        'Could not load the export page.';
      Alert.alert('WebView error', message, [{ text: 'Close', onPress: closeScreen }]);
    },
    [closeScreen]
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.surface }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: palette.surface,
            borderBottomColor: palette.borderSubtle,
            paddingTop: Math.max(insets.top, 8) + 4,
          },
        ]}
      >
        <TouchableOpacity
          onPress={closeScreen}
          style={[styles.closeButton, { backgroundColor: palette.actionSecondary }]}
          activeOpacity={0.86}
        >
          <MaterialIcons name="close" size={16} color={palette.actionSecondaryText} />
          <Text style={[styles.closeButtonText, { color: palette.actionSecondaryText }]}>Close</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: palette.primaryText }]}>Secure key export</Text>
        <View style={styles.headerSpacer} />
      </View>

      {exportUrl ? (
        <WebView
          source={{ uri: exportUrl }}
          onMessage={handleWebViewMessage}
          onError={handleWebViewError}
          incognito
          cacheEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          javaScriptCanOpenWindowsAutomatically
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.loader, { backgroundColor: palette.surface }]}>
              <ActivityIndicator size="small" color={palette.secondaryText} />
              <Text style={[styles.loaderText, { color: palette.secondaryText }]}>
                Loading secure export flow...
              </Text>
            </View>
          )}
          style={styles.webView}
        />
      ) : (
        <View style={[styles.loader, { backgroundColor: palette.surface }]}>
          <Text style={[styles.loaderText, { color: palette.secondaryText }]}>
            Missing export URL configuration.
          </Text>
          <TouchableOpacity
            onPress={closeScreen}
            style={[styles.fallbackButton, { backgroundColor: palette.actionSecondary }]}
          >
            <Text style={[styles.fallbackButtonText, { color: palette.actionSecondaryText }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    borderRadius: 10,
    minHeight: 34,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 66,
  },
  webView: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  loaderText: {
    fontSize: 14,
    textAlign: 'center',
  },
  fallbackButton: {
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
