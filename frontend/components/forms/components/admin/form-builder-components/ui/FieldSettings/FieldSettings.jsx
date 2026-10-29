import React, { useState, useEffect } from 'react';
import { Typography, Empty, Tabs, Button, Spin, Popconfirm, theme as antdTheme } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import BasicSettings from './BasicSettings.jsx';
import StyleSettings from './StyleSettings.jsx';
import ScoringConfig from './ScoringConfig.jsx';
import RatingSettings from './RatingSettings.jsx';
import NPSSettings from './NPSSettings.jsx';
import SliderSettings from './SliderSettings.jsx';
import YesNoSettings from './YesNoSettings.jsx';
import SegmentedSettings from './SegmentedSettings.jsx';
import ChoiceSettings from './ChoiceSettings.jsx';
import CarouselSettings from './CarouselSettings.jsx';
import ButtonSettings from './ButtonSettings.jsx';
import { isScorableField } from '../../constants/fieldDefaults.js';
import { getLanguage } from '../../constants/languages.js';
import { needsTranslation, translateFieldTo } from '../../../../../utils/i18n.js';
import { useToast } from '../../../../../context/ToastContext.jsx';

const { Text } = Typography;

const FieldSettings = ({ field, onUpdate, formSettings }) => {
    const { token } = antdTheme.useToken();
    const { showToast } = useToast();
    const languages = formSettings.languages?.length ? formSettings.languages : ['en'];
    const defaultLang = formSettings.defaultLanguage || 'en';
    const [activeLang, setActiveLang] = useState(defaultLang);
    const [translating, setTranslating] = useState(false);

    // Default language tab is always the first/active one when switching fields
    useEffect(() => {
        setActiveLang(formSettings.defaultLanguage || 'en');
    }, [field?.id, formSettings.defaultLanguage]);

    // Auto-translate when the user opens a language tab with no text yet
    const handleLangChange = async (code) => {
        setActiveLang(code);
        if (!field || code === defaultLang) return;
        if (!needsTranslation(field, code, defaultLang)) return;
        setTranslating(true);
        try {
            const updated = await translateFieldTo(field, code, defaultLang);
            if (updated !== field) {
                onUpdate(field.id, { translations: updated.translations });
            } else {
                showToast('Auto-translation unavailable - type the text manually', 'info');
            }
        } catch {
            showToast('Auto-translation unavailable - type the text manually', 'info');
        }
        setTranslating(false);
    };

    // Force a fresh translation for the active language (overwrites existing)
    const handleRetranslate = async () => {
        if (!field || activeLang === defaultLang) return;
        setTranslating(true);
        try {
            const updated = await translateFieldTo(field, activeLang, defaultLang, { force: true });
            if (updated !== field) {
                onUpdate(field.id, { translations: updated.translations });
                showToast(`Translated to ${getLanguage(activeLang).native}`, 'success');
            } else {
                showToast('Auto-translation unavailable', 'error');
            }
        } catch {
            showToast('Auto-translation unavailable', 'error');
        }
        setTranslating(false);
    };

    if (!field) {
        return (
            <div className="builder-sidebar field-settings-sidebar" style={{
                background: token.colorBgContainer,
                borderLeft: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <Empty description={<Text type="secondary">Select a field to edit its settings</Text>} />
            </div>
        );
    }

    const multilingual = languages.length > 1;
    const langItems = (() => {
        const ordered = [defaultLang, ...languages.filter((l) => l !== defaultLang)];
        return ordered.map((code) => {
            const lang = getLanguage(code);
            return {
                key: code,
                label: (
                    <span style={{ fontSize: '12px' }}>
                        {lang.native}
                        {code === defaultLang && (
                            <span style={{ opacity: 0.55, fontSize: '10px' }}> *</span>
                        )}
                    </span>
                ),
            };
        });
    })();

    const missing = multilingual && activeLang !== defaultLang && needsTranslation(field, activeLang, defaultLang);

    return (
        <div className="builder-sidebar field-settings-sidebar" style={{
            background: token.colorBgContainer,
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'auto',
        }}>
            <div className="sidebar-header" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <Text strong style={{ fontSize: '14px' }}>Element Settings</Text>
            </div>
            <div className="sidebar-content">
                {multilingual && (
                    <div style={{ marginBottom: '4px' }}>
                        <Tabs
                            size="small"
                            activeKey={activeLang}
                            onChange={handleLangChange}
                            items={langItems}
                            tabBarStyle={{ marginBottom: '8px' }}
                        />
                        {activeLang !== defaultLang && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                    {translating
                                        ? 'Translating...'
                                        : missing
                                            ? `Empty - falls back to ${getLanguage(defaultLang).native}`
                                            : `Label & description in ${getLanguage(activeLang).native}`}
                                </Text>
                                {translating ? (
                                    <Spin size="small" />
                                ) : (
                                    <Popconfirm
                                        title={`Overwrite ${getLanguage(activeLang).native} text?`}
                                        description="Re-translating replaces any manual edits in this language."
                                        okText="Translate"
                                        cancelText="Cancel"
                                        onConfirm={handleRetranslate}
                                    >
                                        <Button
                                            size="small"
                                            icon={<ThunderboltOutlined />}
                                            disabled={missing}
                                        >
                                            Translate again
                                        </Button>
                                    </Popconfirm>
                                )}
                            </div>
                        )}
                    </div>
                )}
                <BasicSettings
                    field={field}
                    onUpdate={onUpdate}
                    lang={activeLang}
                    defaultLang={defaultLang}
                />
                <StyleSettings field={field} onUpdate={onUpdate} />
                {isScorableField(field.type) && formSettings.hasScoring && (
                    <ScoringConfig field={field} onUpdate={onUpdate} formSettings={formSettings} />
                )}
                {field.type === 'rating' && <RatingSettings field={field} onUpdate={onUpdate} />}
                {field.type === 'nps' && <NPSSettings field={field} onUpdate={onUpdate} />}
                {field.type === 'slider' && <SliderSettings field={field} onUpdate={onUpdate} />}
                {field.type === 'yesno' && <YesNoSettings field={field} onUpdate={onUpdate} formSettings={formSettings} />}
                {field.type === 'segmented' && <SegmentedSettings field={field} onUpdate={onUpdate} formSettings={formSettings} />}
                {['dropdown', 'radio', 'checkbox'].includes(field.type) && <ChoiceSettings field={field} onUpdate={onUpdate} formSettings={formSettings} />}
                {field.type === 'carousel' && <CarouselSettings field={field} onUpdate={onUpdate} />}
                {field.type === 'button' && <ButtonSettings field={field} onUpdate={onUpdate} />}
            </div>
        </div>
    );
};

export default FieldSettings;
