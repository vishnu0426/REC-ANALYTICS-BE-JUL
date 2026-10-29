import React from 'react';
import { Input, InputNumber, Button, Typography } from 'antd';
import { Plus, Trash2 } from 'lucide-react';

const { Text } = Typography;

const SegmentedSettings = ({ field, onUpdate, formSettings }) => {
    const maxScore = field.max_score || formSettings.totalScore || 100;
    const addOption = () => {
        const newOpt = { label: `Level ${(field.options?.length || 0) + 1}`, value: `level_${(field.options?.length || 0) + 1}`, score: 0 };
        const newOpts = [...(field.options || [])];
        if (newOpts.length > 0 && typeof newOpts[0] === 'string') {
            const converted = newOpts.map(opt => ({ label: opt, value: opt.toLowerCase(), score: 0 }));
            onUpdate(field.id, { options: [...converted, newOpt] });
        } else {
            onUpdate(field.id, { options: [...newOpts, newOpt] });
        }
    };
    const updateOption = (index, updates) => {
        const newOpts = [...field.options];
        const isObject = typeof newOpts[index] === 'object';
        if (isObject) { newOpts[index] = { ...newOpts[index], ...updates }; }
        else { newOpts[index] = { label: updates.label || newOpts[index], value: (updates.label || newOpts[index]).toLowerCase(), score: updates.score || 0 }; }
        onUpdate(field.id, { options: newOpts });
    };
    const removeOption = (index) => { onUpdate(field.id, { options: field.options.filter((_, idx) => idx !== index) }); };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>Priority Levels{formSettings.hasScoring ? ' with Scores' : ''}</Text>
                <Button type="dashed" size="small" icon={<Plus size={12} />} onClick={addOption}>Add</Button>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
                {field.options?.map((opt, i) => {
                    const isObject = typeof opt === 'object';
                    const label = isObject ? opt.label : opt;
                    const score = isObject ? opt.score : 0;
                    return (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Input placeholder="Level name" value={label} onChange={(e) => updateOption(i, { label: e.target.value, value: e.target.value.toLowerCase() })} style={{ flex: 1 }} />
                            {formSettings.hasScoring && <InputNumber placeholder="Score" min={0} max={maxScore} value={score} onChange={(val) => updateOption(i, { score: Math.min(val || 0, maxScore) })} style={{ width: '80px' }} size="small" />}
                            <Button icon={<Trash2 size={14} />} danger type="text" size="small" onClick={() => removeOption(i)} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SegmentedSettings;
