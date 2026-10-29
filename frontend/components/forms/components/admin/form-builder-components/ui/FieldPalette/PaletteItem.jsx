import React from 'react';
import { Typography, theme as antdTheme } from 'antd';

const { Text } = Typography;

const PaletteItem = ({ fieldType, onDragStart, onAdd }) => {
    const { token } = antdTheme.useToken();
    const Icon = fieldType.icon;

    return (
        <div
            className="palette-item"
            draggable
            onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', fieldType.type);
                onDragStart(fieldType.type);
            }}
            onClick={() => onAdd && onAdd(fieldType.type)}
            role="button"
            tabIndex={0}
            style={{
                marginBottom: '8px',
                cursor: 'pointer',
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                padding: '10px 12px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '6px',
                    background: token.colorFillSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: token.colorPrimary,
                }}>
                    <Icon size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: '13px', display: 'block' }}>{fieldType.label}</Text>
                    <Text type="secondary" style={{ fontSize: '11px' }}>{fieldType.description}</Text>
                </div>
            </div>
        </div>
    );
};

export default PaletteItem;
