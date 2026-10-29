import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { theme as themeAntd, ConfigProvider } from 'antd';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within ThemeProvider');
    return context;
};

export const ThemeProvider = ({ children }) => {
    const [mode, setMode] = useState(() => localStorage.getItem('themeMode') || 'light');
    const [colorScheme, setColorScheme] = useState(() => localStorage.getItem('colorScheme') || 'blue');
    const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('fontFamily') || 'inter');

    const colorSchemes = {
        blue: { primary: '#1890ff', lightModeAlternative: '#1890ff' },
        teal: { primary: '#14b8a6', lightModeAlternative: '#14b8a6' },
        purple: { primary: '#722ed1', lightModeAlternative: '#722ed1' },
        orange: { primary: '#fa8c16', lightModeAlternative: '#fa8c16' },
        red: { primary: '#f5222d', lightModeAlternative: '#f5222d' },
        green: { primary: '#52c41a', lightModeAlternative: '#52c41a' },
    };

    const fontFamilies = {
        inter: { value: "'Inter', sans-serif" },
        roboto: { value: "'Roboto', sans-serif" },
        poppins: { value: "'Poppins', sans-serif" },
    };

    const activeConfig = useMemo(() => colorSchemes[colorScheme] || colorSchemes.blue, [colorScheme]);
    const activeFont = useMemo(() => fontFamilies[fontFamily] || fontFamilies.inter, [fontFamily]);

    const currentPrimary = useMemo(() => {
        return (mode === 'dark' && activeConfig.lightModeAlternative)
            ? activeConfig.lightModeAlternative
            : activeConfig.primary;
    }, [mode, activeConfig]);

    useEffect(() => {
        localStorage.setItem('themeMode', mode);
        localStorage.setItem('colorScheme', colorScheme);
        localStorage.setItem('fontFamily', fontFamily);
        const root = document.documentElement;
        root.className = mode === 'dark' ? 'dark-mode' : 'light-mode';
        root.style.setProperty('--primary-color', currentPrimary);
        root.style.setProperty('--font-family', activeFont.value);
    }, [mode, colorScheme, fontFamily, activeConfig, activeFont, currentPrimary]);

    const toggleTheme = () => setMode(prev => prev === 'light' ? 'dark' : 'light');

    const antdTheme = {
        algorithm: mode === 'dark' ? themeAntd.darkAlgorithm : themeAntd.defaultAlgorithm,
        token: {
            colorPrimary: currentPrimary,
            fontFamily: activeFont.value,
            borderRadius: 4,
            controlHeight: 30,
            colorBgContainer: mode === 'dark' ? '#111827' : '#ffffff',
            colorBgElevated: mode === 'dark' ? '#1F2937' : '#ffffff',
            colorBorder: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
        components: {
            Button: { controlHeight: 30, fontSize: 13, fontWeight: 600 },
            Input: { controlHeight: 30 },
            Select: { controlHeight: 30 },
            Card: { colorBgContainer: mode === 'dark' ? 'rgba(17, 24, 39, 0.6)' : '#ffffff', paddingLG: 24, borderRadiusLG: 8 },
            Table: { headerBg: mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)', headerColor: mode === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)', headerBorderRadius: 0, rowHoverBg: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', padding: 12 },
            Modal: { contentBg: mode === 'dark' ? '#111827' : '#ffffff', headerBg: mode === 'dark' ? '#111827' : '#ffffff' },
            Pagination: { itemActiveBg: currentPrimary, borderRadius: 4 },
        }
    };

    const value = { mode, toggleTheme, colorScheme, setColorScheme, fontFamily, setFontFamily, activeConfig, activeFont };

    return (
        <ThemeContext.Provider value={value}>
            <ConfigProvider theme={antdTheme}>
                {children}
            </ConfigProvider>
        </ThemeContext.Provider>
    );
};
