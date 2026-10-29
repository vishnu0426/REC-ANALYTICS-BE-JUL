import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Modal, Input, Switch, Form, Select } from 'antd';
import { SAVE_EVALUATION_FORM, DELETE_EVALUATION_FORM } from '../graphql/mutations.js';
import { getDefaultFormContent } from '../constants/fieldDefaults.js';
import { DEFAULT_LANGUAGE, languageOptions, getLanguage } from '../constants/languages.js';
import { autoTranslateFields } from '../../../../utils/i18n.js';
import { useToast } from '../../../../context/ToastContext.jsx';

const resetCreateModal = () => ({
    open: false,
    formName: '',
    hasScoring: true,
    languages: [DEFAULT_LANGUAGE],
    defaultLanguage: DEFAULT_LANGUAGE,
});

export const useFormOperations = (selectedForm, formFields, formSettings, formTheme, refetch, setFormFields) => {
    const { showToast } = useToast();
    const [saveForm] = useMutation(SAVE_EVALUATION_FORM);
    const [deleteForm] = useMutation(DELETE_EVALUATION_FORM);
    const [createModal, setCreateModal] = useState(resetCreateModal());
    const [translating, setTranslating] = useState(false);

    const buildContent = (fields) => JSON.stringify({
        fields,
        total_score: formSettings.totalScore,
        hasScoring: formSettings.hasScoring,
        theme: formTheme,
        languages: formSettings.languages && formSettings.languages.length > 0
            ? formSettings.languages
            : [DEFAULT_LANGUAGE],
        default_language: formSettings.defaultLanguage || DEFAULT_LANGUAGE,
    });

    const handleSave = async () => {
        if (!selectedForm) {
            showToast('Select or create a form first', 'info');
            return;
        }
        if (formFields.length === 0) {
            showToast('Add at least one field before saving', 'info');
            return;
        }
        try {
            let fieldsToSave = formFields;
            const languages = formSettings.languages || [DEFAULT_LANGUAGE];
            const defaultLang = formSettings.defaultLanguage || DEFAULT_LANGUAGE;
            if (languages.length > 1) {
                // Fill missing translations (never overwrites manual edits).
                setTranslating(true);
                const { fields: translated, translatedCount, failed } =
                    await autoTranslateFields(formFields, languages, defaultLang);
                fieldsToSave = translated;
                if (translatedCount > 0 && setFormFields) setFormFields(translated);
                if (failed) {
                    showToast('Auto-translation unavailable — missing translations were left empty', 'info');
                }
                setTranslating(false);
            }
            await saveForm({
                variables: {
                    form_id: selectedForm.form_id,
                    title: selectedForm.title,
                    form_content: buildContent(fieldsToSave),
                },
            });
            showToast('Form saved successfully!', 'success');
        } catch (err) {
            setTranslating(false);
            showToast('Error saving form', 'error');
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteForm({ variables: { id } });
            showToast('Form deleted successfully!', 'success');
            refetch();
        } catch (err) {
            showToast('Error deleting form', 'error');
        }
    };

    const handleRename = async (newTitle) => {
        if (!selectedForm) return;
        if (!newTitle.trim()) {
            showToast('Form name cannot be empty', 'error');
            return;
        }
        try {
            await saveForm({
                variables: {
                    form_id: selectedForm.form_id,
                    title: newTitle,
                    form_content: buildContent(formFields),
                },
            });
            showToast('Form renamed successfully!', 'success');
            refetch();
        } catch (err) {
            showToast('Error renaming form', 'error');
        }
    };

    const handleCreateNew = () => {
        setCreateModal({ ...resetCreateModal(), open: true });
    };

    const handleCreateConfirm = async () => {
        if (!createModal.formName.trim()) {
            showToast('Enter a form name', 'error');
            return;
        }
        if (!createModal.languages || createModal.languages.length === 0) {
            showToast('Select at least one language', 'error');
            return;
        }
        try {
            const formId = `form_${Date.now()}`;
            const formContent = JSON.stringify({
                ...getDefaultFormContent(),
                hasScoring: createModal.hasScoring,
                languages: createModal.languages,
                default_language: createModal.defaultLanguage,
            });
            await saveForm({
                variables: {
                    form_id: formId,
                    title: createModal.formName,
                    form_content: formContent,
                },
            });
            showToast(
                `Form created successfully! (${createModal.languages.map(l => getLanguage(l).native).join(', ')})`,
                'success'
            );
            setCreateModal(resetCreateModal());
            refetch();
        } catch (err) {
            showToast('Error creating form', 'error');
        }
    };

    const CreateModal = (
        <Modal
            title="Create New Form"
            open={createModal.open}
            onOk={handleCreateConfirm}
            onCancel={() => setCreateModal(resetCreateModal())}
            okText="Create"
            cancelText="Cancel"
            width={520}
        >
            <Form layout="vertical">
                <Form.Item label="Form Name">
                    <Input
                        value={createModal.formName}
                        onChange={(e) => setCreateModal(prev => ({ ...prev, formName: e.target.value }))}
                        placeholder="Enter form name"
                    />
                </Form.Item>
                <Form.Item label="Enable Scoring">
                    <Switch
                        checked={createModal.hasScoring}
                        onChange={(val) => setCreateModal(prev => ({ ...prev, hasScoring: val }))}
                    />
                </Form.Item>
                <Form.Item
                    label="Languages"
                    extra="Pick every language the form will be offered in — each shown in its own script."
                >
                    <Select
                        mode="multiple"
                        showSearch
                        optionFilterProp="label"
                        placeholder="Select languages (e.g. English, हिन्दी, العربية)"
                        value={createModal.languages}
                        onChange={(vals) => setCreateModal(prev => {
                            // Keep the default language inside the selection
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
                    extra="The language you write fields in. Other languages are auto-translated from it."
                >
                    <Select
                        showSearch
                        optionFilterProp="label"
                        value={createModal.defaultLanguage}
                        onChange={(val) => setCreateModal(prev => ({ ...prev, defaultLanguage: val }))}
                        options={languageOptions(createModal.languages)}
                        style={{ width: '100%' }}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );

    return { handleSave, handleDelete, handleRename, handleCreateNew, CreateModal, translating };
};
