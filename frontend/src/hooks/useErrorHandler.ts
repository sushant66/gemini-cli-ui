import { useCallback } from 'react';

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  fallbackMessage?: string;
}

export const useErrorHandler = () => {
  const handleError = useCallback((
    error: unknown,
    context: string,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = false,
      logToConsole = true,
      fallbackMessage = 'An unexpected error occurred'
    } = options;

    let errorMessage: string;
    let errorDetails: any = null;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      errorMessage = fallbackMessage;
      errorDetails = error;
    }

    if (logToConsole) {
      console.error(`[${context}] ${errorMessage}`, errorDetails);
    }

    if (showToast) {
      // TODO: Implement toast notifications
      console.warn('Toast notifications not implemented yet');
    }

    return {
      message: errorMessage,
      details: errorDetails,
      context,
    };
  }, []);

  const handleApiError = useCallback((
    error: unknown,
    context: string,
    options: ErrorHandlerOptions = {}
  ) => {
    // Handle specific API error formats
    if (error && typeof error === 'object' && 'message' in error) {
      return handleError(error.message as string, context, options);
    }

    // Handle fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return handleError(
        'Network error: Unable to connect to the server. Please check your connection.',
        context,
        options
      );
    }

    return handleError(error, context, options);
  }, [handleError]);

  return {
    handleError,
    handleApiError,
  };
};

export default useErrorHandler;