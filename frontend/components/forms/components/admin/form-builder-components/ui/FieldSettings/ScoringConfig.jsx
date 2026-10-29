import React from 'react';
import { InputNumber, Typography, Divider } from 'antd';

const { Text } = Typography;

const ScoringConfig = ({ field, onUpdate, formSettings }) => {
    const maxAllowed = formSettings.totalScore || 100;

    return (
        <div style={{ marginBottom: '20px' }}>
            <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: '12px' }}>Scoring Configuration</Text>
            <div style={{
                background: '#fffbe6',
                border: '1px solid #ffe58f',
                borderRadius: '8px',
                padding: '12px',
            }}>
                <Text style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                    Max Points for this field (out of {maxAllowed})
                </Text>
                <InputNumber
                    min={0}
                    max={maxAllowed}
                    value={field.max_score || 10}
                    onChange={(val) => onUpdate(field.id, { max_score: Math.min(val || 0, maxAllowed) })}
                    style={{ width: '100%' }}
                />
            </div>
            <Divider style={{ margin: '16px 0' }} />
        </div>
    );
};

export default ScoringConfig;
