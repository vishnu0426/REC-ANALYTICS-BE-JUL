import React from 'react';
import { Card, Button, Popconfirm, Typography, theme as antdTheme } from 'antd';
import { Trash2 } from 'lucide-react';

const { Text } = Typography;

const FormCard = ({ form, isSelected, onSelect, onDelete }) => {
    const { token } = antdTheme.useToken();
    return (
        <Card hoverable className={`form-item-card ${isSelected ? 'active' : ''}`} onClick={() => onSelect(form)} style={{ marginBottom: '12px', border: isSelected ? '1px solid transparent' : `1px solid ${token.colorBorderSecondary}`, background: isSelected ? token.colorFillSecondary : token.colorBgContainer, color: isSelected ? token.colorText : token.colorText, transition: 'all 0.3s ease', cursor: 'pointer', borderRadius: '8px' }} styles={{ body: { padding: '8px 16px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}><Text strong style={{ display: 'block', fontSize: '14px' }} ellipsis>{form.title}</Text><Text type="secondary" style={{ fontSize: '11px' }}>Updated {new Date(parseInt(form.createdAt)).toLocaleDateString()}</Text></div>
                <div style={{ display: 'flex', gap: '4px' }}><Popconfirm title="Delete form?" description="This action cannot be undone." onConfirm={(e) => { e.stopPropagation(); onDelete(form.id); }} onCancel={(e) => e.stopPropagation()} okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}><Button type="text" size="small" danger onClick={(e) => e.stopPropagation()} icon={<Trash2 size={14} />} /></Popconfirm></div>
            </div>
        </Card>
    );
};

export default FormCard;
