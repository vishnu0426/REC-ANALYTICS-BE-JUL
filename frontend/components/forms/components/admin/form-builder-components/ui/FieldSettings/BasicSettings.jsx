import React from 'react';
import { Input, Switch, Typography, Divider } from 'antd';
import { getLanguage } from '../../constants/languages.js';

const { Text } = Typography;

// Edits label / description / placeholder for the ACTIVE language tab.
// The default language edits the field's base text directly; any other
// language edits field.translations[lang] (falling back to the base text
// visually when empty, so the builder never looks blank).
const BasicSettings = ({ field, onUpdate, lang = 'en', defaultLang = 'en' }) => {
    const isDefault = !lang || lang === defaultLang;
    const tr = (!isDefault && field.translations?.[lang]) || null;

    const valueOf = (key) => (isDefault ? field[key] : tr?.[key] ?? '');

    const setValue = (key, val) => {
        if (isDefault) {
            onUpdate(field.id, { [key]: val });
        } else {
            onUpdate(field.id, {
                translations: {
                    ...field.translations,
                    [lang]: { ...(field.translations?.[lang] || {}), [key]: val },
                },
            });
        }
    };

    const langName = getLanguage(lang).native;
    const sectionLabel = isDefault ? 'Basic Settings' : `Basic Settings · ${langName}`;
    const hint = isDefault ? null : `Editing ${langName} — empty fields fall back to ${getLanguage(defaultLang).native}`;
    const inputDir = getLanguage(lang).rtl ? 'rtl' : 'ltr';

    return (
        <div style={{ marginBottom: '20px' }}>
            <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: '12px' }}>{sectionLabel}</Text>
            {hint && (
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                    {hint}
                </Text>
            )}
            <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Label Text</Text>
                    <Input
                        value={valueOf('label')}
                        onChange={(e) => setValue('label', e.target.value)}
                        placeholder={isDefault ? 'Field label' : field.label}
                        dir={inputDir}
                    />
                </div>
                <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Internal Description</Text>
                    <Input.TextArea
                        value={valueOf('description')}
                        onChange={(e) => setValue('description', e.target.value)}
                        placeholder={isDefault ? 'Internal description' : field.description}
                        rows={2}
                        dir={inputDir}
                    />
                </div>
                <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Placeholder Hint</Text>
                    <Input
                        value={valueOf('placeholder')}
                        onChange={(e) => setValue('placeholder', e.target.value)}
                        placeholder={isDefault ? 'Placeholder text' : field.placeholder}
                        dir={inputDir}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: '13px' }}>Mandatory Field</Text>
                    <Switch
                        size="small"
                        checked={field.required}
                        onChange={(val) => onUpdate(field.id, { required: val })}
                    />
                </div>
            </div>
            <Divider style={{ margin: '16px 0' }} />
        </div>
    );
};

export default BasicSettings;
