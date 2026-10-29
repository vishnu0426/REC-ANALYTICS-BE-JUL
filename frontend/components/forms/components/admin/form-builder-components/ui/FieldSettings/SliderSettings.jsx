import React from 'react';
import { InputNumber, Space, Typography } from 'antd';
import { ArrowRight } from 'lucide-react';

const { Text } = Typography;

const SliderSettings = ({ field, onUpdate }) => {
    return (
        <div style={{ display: 'grid', gap: '16px' }}>
            <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>Range (Min / Max)</Text>
                <Space>
                    <InputNumber value={field.min} onChange={(val) => onUpdate(field.id, { min: val })} placeholder="Min" />
                    <ArrowRight size={14} />
                    <InputNumber value={field.max} onChange={(val) => onUpdate(field.id, { max: val })} placeholder="Max" />
                </Space>
            </div>
            <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>Step Size</Text>
                <InputNumber value={field.step || 1} onChange={(val) => onUpdate(field.id, { step: val || 1 })} min={1} style={{ width: '100%' }} />
            </div>
        </div>
    );
};

export default SliderSettings;
