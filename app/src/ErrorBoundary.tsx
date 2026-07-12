import { Component, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';

/**
 * Error boundaries must be class components. This catches JS render errors so a
 * thrown error shows a readable message (invaluable for TestFlight dogfooding)
 * instead of a hard crash. Note: it does NOT catch native crashes (e.g. a
 * native module) — those still need the device crash log. Colours are inlined
 * because this must render even if theming is what broke.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error('Yumo caught a render error:', error);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#17130F', padding: 24, paddingTop: 80 }}>
          <Text style={{ color: '#FF6A3D', fontSize: 22, fontWeight: '800' }}>Something broke</Text>
          <Text style={{ color: '#C7BBAA', fontSize: 14, marginTop: 8 }}>
            This screen hit an error — screenshot this and it gets fixed:
          </Text>
          <ScrollView style={{ marginTop: 16, maxHeight: 420 }}>
            <Text selectable style={{ color: '#F7F2EA', fontSize: 12 }}>
              {error.message}
              {'\n\n'}
              {error.stack ?? ''}
            </Text>
          </ScrollView>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={{ marginTop: 20, backgroundColor: '#FF6A3D', padding: 16, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: '#1A1310', fontWeight: '700' }}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
