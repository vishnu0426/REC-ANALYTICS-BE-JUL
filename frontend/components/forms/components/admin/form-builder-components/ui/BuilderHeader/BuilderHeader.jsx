import React, { useState } from 'react';
import { Button, Space, Switch, InputNumber, Input, Tooltip, Typography, Select, Modal, Form, theme as antdTheme } from 'antd';
import { Save, Eye, Palette, Edit3, Languages } from 'lucide-react';
import { DEFAULT_LANGUAGE, languageOptions, getLanguage } from '../../constants/languages.js';

const { Text } = Typography;

const BuilderHeader = ({
    form, formFields, formSettings, setFormSettings, onTotalScoreChange,
    onRename, onSave, onPreview, onThemeSettings, translating = false
}) => {
    const { token } = antdTheme.useToken();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [langModal, setLangModal] = useState(false);
    const [langDraft, setLangDraft] = useState({ languages: [], defaultLanguage: DEFAULT_LANGUAGE });

    const handleTitleSave = () => {
        if (editTitle.trim()) {
            onRename(editTitle.trim());
        }
        setIsEditing(false);
    };

    const openLangModal = () => {
        setLangDraft({
            languages: formSettings.languages?.length ? formSettings.languages : [DEFAULT_LANGUAGE],
            defaultLanguage: formSettings.defaultLanguage || DEFAULT_LANGUAGE,
        });
        setLangModal(true);
    };

    const confirmLanguages = () => {
        if (!langDraft.languages.length) {
            return; // Select is required to hold at least one language
        }
        setFormSettings(prev => ({
            ...prev,
            languages: langDraft.languages,
            defaultLanguage: langDraft.languages.includes(langDraft.defaultLanguage)
                ? langDraft.defaultLanguage
                : langDraft.languages[0],
        }));
        setLangModal(false);
    };

    if (!form) return null;

    const languages = formSettings.languages?.length ? formSettings.languages : [DEFAULT_LANGUAGE];

    return (
        <div className="builder-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 24px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isEditing ? (
                    <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onPressEnter={handleTitleSave}
                        onBlur={handleTitleSave}
                        style={{ width: 200 }}
                    />
                ) : (
                    <Space>
                        <Text strong style={{ fontSize: '16px' }}>{form.title}</Text>
                        <Tooltip title="Edit title">
                            <Button
                                type="text"
                                size="small"
                                icon={<Edit3 size={14} />}
                                onClick={() => { setEditTitle(form.title); setIsEditing(true); }}
                            />
                        </Tooltip>
                    </Space>
                )}
                <Text type="secondary" style={{ fontSize: '12px' }}>
                    {formFields.length} element{formFields.length !== 1 ? 's' : ''}
                </Text>
            </div>
            <Space>
                <Tooltip title="Form languages">
                    <Button icon={<Languages size={16} />} onClick={openLangModal}>
                        {languages.map((c) => getLanguage(c).native).join(' · ')}
                    </Button>
                </Tooltip>
                <Space>
                    <Text style={{ fontSize: '13px' }}>Scoring:</Text>
                    <Switch
                        size="small"
                        checked={formSettings.hasScoring}
                        onChange={(val) => setFormSettings(prev => ({ ...prev, hasScoring: val }))}
                    />
                </Space>
                {formSettings.hasScoring && (
                    <Space>
                        <Text style={{ fontSize: '13px' }}>Total Max Score:</Text>
                        <InputNumber
                            min={1}
                            max={10000}
                            value={formSettings.totalScore}
                            onChange={(val) => onTotalScoreChange ? onTotalScoreChange(val || 100) : setFormSettings(prev => ({ ...prev, totalScore: val || 100 }))}
                            style={{ width: 80 }}
                            size="small"
                        />
                    </Space>
                )}
                <Tooltip title="Theme Settings">
                    <Button icon={<Palette size={16} />} onClick={onThemeSettings} />
                </Tooltip>
                <Tooltip title="Preview Form">
                    <Button icon={<Eye size={16} />} onClick={onPreview} />
                </Tooltip>
                <Button type="primary" icon={<Save size={16} />} onClick={onSave} loading={translating}>
                    Save Form
                </Button>
            </Space>

            <Modal
                title="Form Languages"
                open={langModal}
                onOk={confirmLanguages}
                onCancel={() => setLangModal(false)}
                okText="Apply"
                cancelText="Cancel"
                width={520}
            >
                <Form layout="vertical">
                    <Form.Item
                        label="Languages"
                        extra="Pick every language the form is offered in — each shown in its own script. Adding a language opens a tab for it in every field editor."
                    >
                        <Select
                            mode="multiple"
                            showSearch
                            optionFilterProp="label"
                            placeholder="Select languages"
                            value={langDraft.languages}
                            onChange={(vals) => setLangDraft(prev => {
                                let defaultLang = prev.defaultLanguage;
                                if (!vals.includes(defaultLang)) defaultLang = vals[0] || DEFAULT_LANGUAGE;
                                return { ...prev, languages: vals, defaultLanguage: defaultLang };
                            })}
                            options={languageOptions()}
                            maxTagCount="responsive"
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                    <Form.Item
                        label="Default Language"
                        extra="The source language you write fields in. Save fills every other language automatically."
                    >
                        <Select
                            showSearch
                            optionFilterProp="label"
                            value={langDraft.defaultLanguage}
                            onChange={(val) => setLangDraft(prev => ({ ...prev, defaultLanguage: val }))}
                            options={languageOptions(langDraft.languages)}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default BuilderHeader;
