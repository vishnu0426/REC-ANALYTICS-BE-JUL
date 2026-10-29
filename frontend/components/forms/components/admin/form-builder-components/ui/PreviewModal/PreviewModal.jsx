import React, { useState, useEffect } from 'react';
import { Modal, Button, Space, Tag, Typography, Select, theme as antdTheme } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { FieldPreview } from '../FieldPreviews/renderFieldPreview.jsx';
import { localizeFields, isRTL } from '../../../../../utils/i18n.js';
import { languageOptions, DEFAULT_LANGUAGE } from '../../constants/languages.js';

const { Title, Paragraph, Text } = Typography;

const PreviewModal = ({ open, onClose, form, fields, formTheme, languages, defaultLanguage }) => {
    const { token } = antdTheme.useToken();
    const langList = languages?.length ? languages : [DEFAULT_LANGUAGE];
    const defLang = defaultLanguage || DEFAULT_LANGUAGE;
    const [previewLang, setPreviewLang] = useState(defLang);
    // Reset to the default language each time the preview opens
    useEffect(() => { setPreviewLang(defLang); }, [open, defLang]);
    if (!form) return null;
    const theme = formTheme || form.theme || {};
    const primaryColor = theme.primaryColor || token.colorPrimary;
    const bgColor = theme.backgroundColor || token.colorBgLayout;

    // Determine readable text color based on background luminance
    const isDarkBg = (() => {
        if (theme.backgroundImage) return true; // assume images are usually dark/cover
        const hex = (bgColor || '#ffffff').replace('#', '');
        if (hex.length !== 6) return false;
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
    })();
    const textColor = isDarkBg ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)';
    const textSecondaryColor = isDarkBg ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)';
    const cardBg = isDarkBg ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)';
    const rtl = isRTL(previewLang);
    const shownFields = localizeFields(fields, previewLang, defLang);

    return (
        <Modal
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '95%' }}>
                    <Space>Form Preview</Space>
                    <Space>
                        {langList.length > 1 && (
                            <Select
                                value={previewLang}
                                onChange={setPreviewLang}
                                options={languageOptions(langList)}
                                size="small"
                                style={{ minWidth: 170 }}
                                suffixIcon={<GlobalOutlined />}
                                optionFilterProp="label"
                                showSearch
                            />
                        )}
                        <Tag color='green'>Live Simulation</Tag>
                    </Space>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={800}
            centered
            styles={{ body: { padding: '20px', background: token.colorBgContainer, overflowX: 'hidden' } }}
        >
            <div className='preview-form-container' dir={rtl ? 'rtl' : 'ltr'} style={{ minHeight: '400px', backgroundColor: bgColor, backgroundImage: theme.backgroundImage ? `url(${theme.backgroundImage})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', padding: '40px 20px', borderRadius: '16px', '--form-primary': primaryColor }}>
                <Title level={2} style={{ marginBottom: '8px', wordBreak: 'break-word', color: textColor }}>{form.title}</Title>
                <Paragraph style={{ marginBottom: '40px', wordBreak: 'break-word', color: textSecondaryColor }}>{form.description || 'Please fill out the evaluation form below. All fields marked with * are mandatory.'}</Paragraph>
                <div className='form-fields-grid'>
                    {shownFields.map((field) => {
                        const borderless = field.borderStyle === 'borderless';
                        return (
                            <div
                                key={field.id}
                                className={`field-card ${borderless ? 'borderless' : ''}`}
                                style={borderless
                                    ? { background: 'transparent', border: 'none', padding: '8px 4px' }
                                    : { background: cardBg, border: isDarkBg ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)' }}
                            >
                                <div className='field-card-header'><Space className='field-card-title-row'><Text strong className='field-card-title' style={{ color: textColor }}>{field.label}</Text>{field.required && <Text type='danger'>*</Text>}</Space>{field.description && <div className='field-card-description' style={{ color: textSecondaryColor }}>{field.description}</div>}</div>
                                <div className='preview-field'><FieldPreview field={field} isPreview /></div>
                            </div>
                        );
                    })}
                </div>
                <Button type='primary' block size='large' style={{ height: '56px', borderRadius: '12px', fontSize: '16px', fontWeight: 600, marginTop: '48px', backgroundColor: primaryColor, borderColor: primaryColor }}>Submit Evaluation</Button>
            </div>
        </Modal>
    );
};

export default PreviewModal;
