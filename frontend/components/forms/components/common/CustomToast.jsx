import React from 'react';
import { CheckCircleFilled, CloseCircleFilled, InfoCircleFilled, ExclamationCircleFilled, CloseOutlined } from '@ant-design/icons';

const PRESETS = {
    success: { Icon: CheckCircleFilled, color: '#12805A' },
    error: { Icon: CloseCircleFilled, color: '#C1352E' },
    info: { Icon: InfoCircleFilled, color: '#2F6FED' },
    warning: { Icon: ExclamationCircleFilled, color: '#9C6510' },
};

/**
 * Small top-right notification stack: green = success, red = error,
 * blue = info. Rendered automatically by ToastProvider.
 */
const CustomToast = ({ toasts = [], onHide }) => {
    if (!toasts.length) return null;

    return (
        <div className="app-toast-stack">
            {toasts.map((t) => {
                const preset = PRESETS[t.type] || PRESETS.info;
                const Icon = preset.Icon;
                return (
                    <div key={t.id} className={`app-toast app-toast--${PRESETS[t.type] ? t.type : 'info'}`}>
                        <span className="app-toast__icon">
                            <Icon style={{ fontSize: '15px', color: preset.color }} />
                        </span>
                        <span className="app-toast__message">{t.message}</span>
                        <button onClick={() => onHide(t.id)} className="app-toast__close" aria-label="Dismiss notification">
                            <CloseOutlined style={{ fontSize: '11px' }} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default CustomToast;
