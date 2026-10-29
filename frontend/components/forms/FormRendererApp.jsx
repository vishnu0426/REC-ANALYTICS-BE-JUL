"use client";

import React from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { ConfigProvider } from 'antd';
import FormRendererPage from './components/common/FormRendererPage.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { apolloClient } from './config.js';

// Provider stack for the public form-fill page (/forms/f/<id>) — same as
// FormBuilderApp, hosting the renderer instead of the builder.
function FormRendererApp() {
  return (
    <ApolloProvider client={apolloClient}>
      <ThemeProvider>
        <ToastProvider>
          <ConfigProvider>
            <FormRendererPage />
          </ConfigProvider>
        </ToastProvider>
      </ThemeProvider>
    </ApolloProvider>
  );
}

export default FormRendererApp;
