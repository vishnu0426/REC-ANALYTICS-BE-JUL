import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Spin, Button, Typography, Space, Select } from 'antd';
import { ArrowLeft, Globe } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_EVALUATION_FORM } from '../admin/form-builder-components/graphql/queries.js';
import { SAVE_EVALUATION_RESPONSE } from '../admin/form-builder-components/graphql/mutations.js';
import FormRenderer from './FormRenderer.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { calculateScore, getMissingRequiredFields } from '../../utils/score-utils.js';
import { localizeFields, isRTL } from '../../utils/i18n.js';
import { languageOptions } from '../admin/form-builder-components/constants/languages.js';

const { Title, Text } = Typography;

const FormRendererPage = () => {
    const { formId } = useParams();
    const router = useRouter();
    const { showToast } = useToast();
    const [responses, setResponses] = useState({});
    const [form, setForm] = useState(null);
    const [lang, setLang] = useState(null);

    const { loading, error } = useQuery(GET_EVALUATION_FORM, {
        variables: { id: formId },
        onCompleted: (data) => {
            if (data?.getEvaluationForm) {
                const formData = data.getEvaluationForm;
                const content = JSON.parse(formData.form_content);
                setForm({ ...formData, form_content: content });
                // Open in the form's default language (a user's preferred
                // language can be picked from the selector below)
                setLang(content.default_language || 'en');
            }
        },
    });

    const [saveResponse] = useMutation(SAVE_EVALUATION_RESPONSE);

    const handleChange = (fieldId, value) => {
        setResponses((prev) => ({ ...prev, [fieldId]: value }));
    };

    const handleSubmit = async () => {
        const defaultLang = form?.form_content?.default_language || 'en';
        const active = lang || defaultLang;
        // Validate on the raw fields but report labels in the selected language
        const localized = localizeFields(form?.form_content?.fields, active, defaultLang);
        const missing = getMissingRequiredFields(localized, responses);
        if (missing.length > 0) {
            showToast(`Fill the required fields: ${missing.join(', ')}`, 'error');
            return;
        }
        try {
            const score = calculateScore(form, responses);
            await saveResponse({
                variables: {
                    form_id: form?.form_id,
                    responses: JSON.stringify(responses),
                    tags: JSON.stringify([]),
                    score,
                },
            });
            showToast('Form submitted successfully!', 'success');
            // Brief pause so the success toast is visible before the route
            // unmounts this provider.
            setTimeout(() => router.push('/forms'), 1200);
        } catch (err) {
            showToast('Failed to submit form', 'error');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (error || !form) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <Title level={3}>Form not found</Title>
                <Button onClick={() => router.push('/forms')}>Back to Form Builder</Button>
            </div>
        );
    }

    const content = form.form_content || {};
    const fields = content.fields || [];
    const theme = content.theme || {};
    const languages = content.languages?.length ? content.languages : ['en'];
    const defaultLang = content.default_language || 'en';
    const activeLang = lang || defaultLang;
    const localizedFields = localizeFields(fields, activeLang, defaultLang);
    const rtl = isRTL(activeLang);

    return (
        <div style={{
            minHeight: '100vh',
            background: theme.backgroundImage ? `url(${theme.backgroundImage})` : (theme.backgroundColor || '#f5f5f5'),
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            padding: '40px 20px',
        }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }} dir={rtl ? 'rtl' : 'ltr'}>
                <Space style={{ marginBottom: 24 }} wrap>
                    <Button icon={<ArrowLeft />} onClick={() => router.push('/forms')}>
                        Back
                    </Button>
                    {languages.length > 1 && (
                        <Select
                            value={activeLang}
                            onChange={setLang}
                            options={languageOptions(languages)}
                            style={{ minWidth: 200 }}
                            suffixIcon={<Globe size={14} />}
                            optionFilterProp="label"
                            showSearch
                        />
                    )}
                </Space>
                <Card>
                    <Title level={2}>{form.title}</Title>
                    <Text type="secondary">Please fill out the form below. All fields marked with * are mandatory.</Text>
                    <div style={{ marginTop: 24 }}>
                        <FormRenderer
                            fields={localizedFields}
                            responses={responses}
                            onChange={handleChange}
                            formTheme={theme}
                            onSubmit={handleSubmit}
                            onReset={() => { setResponses({}); showToast('Form cleared', 'info'); }}
                        />
                    </div>
                    <Button
                        type="primary"
                        block
                        size="large"
                        style={{ marginTop: 32, height: 48 }}
                        onClick={handleSubmit}
                    >
                        Submit
                    </Button>
                </Card>
            </div>
        </div>
    );
};

export default FormRendererPage;
