"use client";

import React from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { ConfigProvider } from 'antd';
import FormBuilder from './components/admin/FormBuilder.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { apolloClient } from './config.js';

// Port of the Vite project's main.jsx provider stack. BrowserRouter is gone —
// Next's app router owns routing now.
function FormBuilderApp() {
  return (
    <ApolloProvider client={apolloClient}>
      <ThemeProvider>
        <ToastProvider>
          <ConfigProvider>
            <FormBuilder />
          </ConfigProvider>
        </ToastProvider>
      </ThemeProvider>
    </ApolloProvider>
  );
}

export default FormBuilderApp;
