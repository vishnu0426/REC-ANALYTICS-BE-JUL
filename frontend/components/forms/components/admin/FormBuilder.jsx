import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { Spin } from 'antd';
import { GET_EVALUATION_FORMS } from './form-builder-components/graphql/queries.js';
import { useFormOperations } from './form-builder-components/hooks/useFormOperations.jsx';
import { useFieldOperations } from './form-builder-components/hooks/useFieldOperations.js';
import { useDragAndDrop } from './form-builder-components/hooks/useDragAndDrop.js';
import FormsLibrary from './form-builder-components/ui/FormsLibrary/FormsLibrary.jsx';
import BuilderHeader from './form-builder-components/ui/BuilderHeader/BuilderHeader.jsx';
import FieldPalette from './form-builder-components/ui/FieldPalette/FieldPalette.jsx';
import BuilderCanvas from './form-builder-components/ui/BuilderCanvas/BuilderCanvas.jsx';
import FieldSettings from './form-builder-components/ui/FieldSettings/FieldSettings.jsx';
import PreviewModal from './form-builder-components/ui/PreviewModal/PreviewModal.jsx';
import FormThemeSettings from './form-builder-components/ui/FormThemeSettings/FormThemeSettings.jsx';
import { redistributeScores, rescaleFieldsToTotal } from './form-builder-components/constants/fieldDefaults.js';

const FormBuilder = () => {
    const { loading, data, refetch } = useQuery(GET_EVALUATION_FORMS);
    const [selectedForm, setSelectedForm] = useState(null);
    const [selectedField, setSelectedField] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [showThemeSettings, setShowThemeSettings] = useState(false);
    const [formFields, setFormFields] = useState([]);
    const [formSettings, setFormSettings] = useState({
        hasScoring: false,
        totalScore: 100,
        languages: ['en'],
        defaultLanguage: 'en',
    });
    const [formTheme, setFormTheme] = useState({ mode: 'dark', backgroundColor: '#000000', backgroundImage: '', primaryColor: '#14b8a6' });

    const { handleSave, handleDelete, handleRename, handleCreateNew, CreateModal, translating } = useFormOperations(
        selectedForm, formFields, formSettings, formTheme, refetch, setFormFields
    );
    const { addField, updateField, deleteField, duplicateField } = useFieldOperations(
        formFields, setFormFields, selectedField, setSelectedField
    );
    const { handleDragStart, handlePaletteDragStart, handleDragOver, handleCanvasDrop, ghostIndex } = useDragAndDrop(
        formFields, setFormFields, addField
    );

    useEffect(() => {
        if (data?.getEvaluationForms && data.getEvaluationForms.length > 0 && !selectedForm) {
            const firstForm = data.getEvaluationForms[0];
            const content = JSON.parse(firstForm.form_content);
            setSelectedForm(firstForm);
            setFormFields(content.fields || []);
            setFormSettings({
                hasScoring: content.hasScoring || false,
                totalScore: content.total_score || 100,
                languages: content.languages?.length ? content.languages : ['en'],
                defaultLanguage: content.default_language || 'en',
            });
            setFormTheme(content.theme || { mode: 'dark', backgroundColor: '#000000', backgroundImage: '', primaryColor: '#14b8a6' });
        }
    }, [data]);

    const handleSelectForm = (form) => {
        const content = JSON.parse(form.form_content);
        setSelectedForm(form);
        setFormFields(content.fields || []);
        setFormSettings({
            hasScoring: content.hasScoring || false,
            totalScore: content.total_score || 100,
            languages: content.languages?.length ? content.languages : ['en'],
            defaultLanguage: content.default_language || 'en',
        });
        setFormTheme(content.theme || { mode: 'dark', backgroundColor: '#000000', backgroundImage: '', primaryColor: '#14b8a6' });
        setSelectedField(null);
    };

    const handleUpdateField = (id, updates) => {
        // Auto-redistribute: changing a field's max_score keeps the form total constant
        if (updates.max_score !== undefined && formSettings.hasScoring) {
            const total = formSettings.totalScore || 100;
            const newScore = Math.max(0, Math.min(updates.max_score, total));
            const newFields = redistributeScores(formFields, id, newScore, total);
            setFormFields(newFields);
            if (selectedField?.id === id) {
                setSelectedField({ ...selectedField, ...updates, max_score: newScore });
            }
            return;
        }
        updateField(id, updates);
    };

    // Changing Total Max Score rescales every scorable field proportionally
    const handleTotalScoreChange = (val) => {
        const newTotal = val || 100;
        setFormSettings(prev => ({ ...prev, totalScore: newTotal }));
        if (formSettings.hasScoring && formFields.length > 0) {
            const rescaled = rescaleFieldsToTotal(formFields, newTotal);
            setFormFields(rescaled);
            if (selectedField) {
                const updated = rescaled.find(f => f.id === selectedField.id);
                if (updated) setSelectedField(updated);
            }
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="form-builder-studio">
            <FormsLibrary
                forms={data?.getEvaluationForms || []}
                selectedForm={selectedForm}
                onSelectForm={handleSelectForm}
                onDelete={handleDelete}
                onCreate={handleCreateNew}
                loading={loading}
            />
            <div className="builder-main-area">
                <BuilderHeader
                    form={selectedForm}
                    formFields={formFields}
                    formSettings={formSettings}
                    setFormSettings={setFormSettings}
                    onTotalScoreChange={handleTotalScoreChange}
                    onRename={handleRename}
                    onSave={handleSave}
                    onPreview={() => setShowPreview(true)}
                    onThemeSettings={() => setShowThemeSettings(true)}
                    translating={translating}
                />
                <div className="builder-workspace">
                    <FieldPalette onDragStart={handlePaletteDragStart} onAddField={addField} />
                    <BuilderCanvas
                        fields={formFields}
                        selectedField={selectedField}
                        onSelectField={setSelectedField}
                        onUpdateField={handleUpdateField}
                        onDeleteField={deleteField}
                        onDuplicateField={duplicateField}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleCanvasDrop}
                        ghostIndex={ghostIndex}
                        onAddField={() => addField('text')}
                    />
                    <FieldSettings
                        field={selectedField}
                        onUpdate={handleUpdateField}
                        formSettings={formSettings}
                    />
                </div>
            </div>
            <PreviewModal
                open={showPreview}
                onClose={() => setShowPreview(false)}
                form={selectedForm}
                fields={formFields}
                formTheme={formTheme}
                languages={formSettings.languages}
                defaultLanguage={formSettings.defaultLanguage}
            />
            <FormThemeSettings
                open={showThemeSettings}
                onClose={() => setShowThemeSettings(false)}
                theme={formTheme}
                onChange={setFormTheme}
            />
            {CreateModal}
        </div>
    );
};

export default FormBuilder;
