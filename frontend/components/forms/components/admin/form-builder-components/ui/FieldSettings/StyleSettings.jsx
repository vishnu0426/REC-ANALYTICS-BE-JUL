import React from 'react';
import { Segmented, Typography, Divider } from 'antd';

const { Text } = Typography;

const StyleSettings = ({ field, onUpdate }) => {
    return (
        <div style={{ marginBottom: '20px' }}>
            <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: '12px' }}>Style Settings</Text>
            <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Border Style</Text>
                    <Segmented
                        options={[
                            { label: 'Bordered', value: 'bordered' },
                            { label: 'Borderless', value: 'borderless' },
                        ]}
                        value={field.borderStyle || 'bordered'}
                        onChange={(val) => onUpdate(field.id, { borderStyle: val })}
                        block
                    />
                </div>
                <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Alignment</Text>
                    <Segmented
                        options={[
                            { label: 'Left', value: 'left' },
                            { label: 'Center', value: 'center' },
                            { label: 'Right', value: 'right' },
                        ]}
                        value={field.alignment || 'left'}
                        onChange={(val) => onUpdate(field.id, { alignment: val })}
                        block
                    />
                </div>
            </div>
            <Divider style={{ margin: '16px 0' }} />
        </div>
    );
};

export default StyleSettings;
