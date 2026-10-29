import React from 'react';
import { InputNumber, Typography, theme as antdTheme } from 'antd';

const { Text } = Typography;

const YesNoSettings = ({ field, onUpdate, formSettings }) => {
    const { token } = antdTheme.useToken();
    if (!formSettings.hasScoring) return null;
    const maxScore = field.max_score || formSettings.totalScore || 100;

    return (
        <div style={{ background: token.colorBgLayout, padding: '16px', borderRadius: '12px' }}>
            <Text strong style={{ display: 'block', marginBottom: '12px', fontSize: '13px' }}>Yes/No Scoring</Text>
            <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text>Score for "Yes"</Text>
                    <InputNumber min={0} max={maxScore} value={field.yes_score || 10} onChange={(val) => onUpdate(field.id, { yes_score: Math.min(val || 0, maxScore) })} style={{ width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text>Score for "No"</Text>
                    <InputNumber min={0} max={maxScore} value={field.no_score || 0} onChange={(val) => onUpdate(field.id, { no_score: Math.min(val || 0, maxScore) })} style={{ width: '100px' }} />
                </div>
            </div>
        </div>
    );
};

export default YesNoSettings;
