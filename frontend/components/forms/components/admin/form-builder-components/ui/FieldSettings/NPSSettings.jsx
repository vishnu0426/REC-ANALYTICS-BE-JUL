import React from 'react';
import { InputNumber, Typography, Divider } from 'antd';

const { Text } = Typography;

const NPSSettings = ({ field, onUpdate }) => {
    const npsMin = field.nps_min || 0;
    const npsMax = field.nps_max || 10;
    const npsScores = field.nps_scores || {};

    const updateNpsScore = (num, score) => {
        onUpdate(field.id, { nps_scores: { ...npsScores, [num]: score } });
    };

    return (
        <div style={{ marginBottom: '20px' }}>
            <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: '12px' }}>NPS Settings</Text>
            <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Min</Text>
                        <InputNumber value={npsMin} onChange={(val) => onUpdate(field.id, { nps_min: val || 0 })} style={{ width: '100%' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Max</Text>
                        <InputNumber value={npsMax} onChange={(val) => onUpdate(field.id, { nps_max: val || 10 })} style={{ width: '100%' }} />
                    </div>
                </div>
                <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>Score per Number</Text>
                    {Array.from({ length: npsMax - npsMin + 1 }, (_, i) => npsMin + i).map(num => (
                        <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <Text style={{ width: 40, fontSize: '12px' }}>{num}</Text>
                            <InputNumber
                                min={0}
                                value={npsScores[num] || num * 10}
                                onChange={(val) => updateNpsScore(num, val || 0)}
                                style={{ width: 80 }}
                                size="small"
                            />
                        </div>
                    ))}
                </div>
            </div>
            <Divider style={{ margin: '16px 0' }} />
        </div>
    );
};

export default NPSSettings;
