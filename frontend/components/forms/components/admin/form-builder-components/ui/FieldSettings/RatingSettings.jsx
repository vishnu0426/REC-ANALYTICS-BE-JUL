import React from 'react';
import { InputNumber, Typography, Divider, Input } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from 'antd';

const { Text } = Typography;

const RatingSettings = ({ field, onUpdate }) => {
    const maxStars = field.maxStars || 5;
    const starScores = field.star_scores || {};

    const updateStarScore = (star, score) => {
        onUpdate(field.id, { star_scores: { ...starScores, [star]: score } });
    };

    return (
        <div style={{ marginBottom: '20px' }}>
            <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: '12px' }}>Rating Settings</Text>
            <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Max Stars</Text>
                    <InputNumber
                        min={1}
                        max={10}
                        value={maxStars}
                        onChange={(val) => onUpdate(field.id, { maxStars: val || 5 })}
                        style={{ width: '100%' }}
                    />
                </div>
                <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>Score per Star</Text>
                    {Array.from({ length: maxStars }, (_, i) => i + 1).map(star => (
                        <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <Text style={{ width: 60, fontSize: '12px' }}>{star} star{star > 1 ? 's' : ''}</Text>
                            <InputNumber
                                min={0}
                                value={starScores[star] || star * 2}
                                onChange={(val) => updateStarScore(star, val || 0)}
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

export default RatingSettings;
