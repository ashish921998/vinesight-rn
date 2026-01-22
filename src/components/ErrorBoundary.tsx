import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || null,
    });

    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 bg-gray-50 items-center justify-center p-6">
          <View
            className="w-24 h-24 rounded-3xl items-center justify-center mb-6"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          >
            <Ionicons name="alert-circle" size={56} color="#EF4444" />
          </View>

          <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
            Oops! Something went wrong
          </Text>

          <Text className="text-base text-gray-600 text-center mb-6">
            We&apos;re sorry for the inconvenience. The app encountered an unexpected error.
          </Text>

          {__DEV__ && this.state.error && (
            <ScrollView className="w-full max-h-48 mb-6 bg-red-50 rounded-2xl p-4">
              <Text className="text-xs font-mono text-red-900 mb-2">
                {this.state.error.toString()}
              </Text>
              {this.state.errorInfo && (
                <Text className="text-xs font-mono text-red-700">{this.state.errorInfo}</Text>
              )}
            </ScrollView>
          )}

          <TouchableOpacity
            onPress={this.handleReset}
            activeOpacity={0.8}
            className="bg-green-600 px-8 py-4 rounded-2xl"
          >
            <Text className="text-white text-base font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
