import React from 'react';
import { Card, Button, Space, Typography, theme as antdTheme } from 'antd';
import { GripVertical, Copy, Trash2 } from 'lucide-react';
import { FieldPreview } from '../FieldPreviews/renderFieldPreview.jsx';

const { Text } = Typography;

const CanvasField = ({
    field, index, isSelected, onSelect, onUpdate,
    onDelete, onDuplicate, onDragStart, onDragOver, onDrop
}) => {
    const { token } = antdTheme.useToken();

    return (
        <div
            className={`canvas-field-card ${isSelected ? 'selected' : ''}`}
            onClick={onSelect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            style={{
                border: isSelected ? `2px solid ${token.colorPrimary}` : `1px solid ${token.colorBorderSecondary}`,
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
                background: token.colorBgContainer,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <div
                        draggable
                        onDragStart={onDragStart}
                        style={{ cursor: 'grab', color: token.colorTextSecondary }}
                    >
                        <GripVertical size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <Text strong style={{ fontSize: '14px' }}>
                            {field.label}
                        </Text>
                        {field.description && (
                            <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                                {field.description}
                            </Text>
                        )}
                    </div>
                </div>
                <Space size="4">
                    <Button
                        type="text"
                        size="small"
                        icon={<Copy size={14} />}
                        onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                    />
                    <Button
                        type="text"
                        size="small"
                        danger
                        icon={<Trash2 size={14} />}
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    />
                </Space>
            </div>
            <div style={{ marginTop: '12px' }}>
                <FieldPreview field={field} isPreview={false} />
            </div>
        </div>
    );
};

export default CanvasField;
