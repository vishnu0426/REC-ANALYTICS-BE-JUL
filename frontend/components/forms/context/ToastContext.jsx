import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import CustomToast from '../components/common/CustomToast.jsx';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

let nextToastId = 0;

/**
 * Queue-based toasts: showToast(message, type) with type
 * 'success' | 'error' | 'info' | 'warning'. Several can stack in the
 * top-right corner; each auto-dismisses after 3s. The toast stack is
 * rendered by the provider itself, so it is always available wherever
 * the provider wraps (forms routes and the call QA panel).
 */
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef({});

    const hideToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        if (timersRef.current[id]) {
            clearTimeout(timersRef.current[id]);
            delete timersRef.current[id];
        }
    }, []);

    const showToast = useCallback((message, type = 'success') => {
        const id = ++nextToastId;
        setToasts((prev) => [...prev, { id, message, type }]);
        timersRef.current[id] = setTimeout(() => hideToast(id), 3000);
    }, [hideToast]);

    useEffect(() => {
        const timers = timersRef.current;
        return () => {
            Object.values(timers).forEach(clearTimeout);
        };
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, hideToast, toasts }}>
            {children}
            <CustomToast toasts={toasts} onHide={hideToast} />
        </ToastContext.Provider>
    );
};
