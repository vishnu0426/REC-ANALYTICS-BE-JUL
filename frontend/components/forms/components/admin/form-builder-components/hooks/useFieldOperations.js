import { getDefaultField } from '../constants/fieldDefaults.js';

export const useFieldOperations = (formFields, setFormFields, selectedField, setSelectedField) => {
    const addField = (type, index) => {
        const newField = getDefaultField(type);
        const newFields = [...formFields];
        if (index !== undefined) {
            newFields.splice(index, 0, newField);
        } else {
            newFields.push(newField);
        }
        setFormFields(newFields);
        setSelectedField(newField);
    };

    const updateField = (id, updates) => {
        const newFields = formFields.map(f => f.id === id ? { ...f, ...updates } : f);
        setFormFields(newFields);
        if (selectedField?.id === id) {
            setSelectedField({ ...selectedField, ...updates });
        }
    };

    const deleteField = (id) => {
        setFormFields(formFields.filter(f => f.id !== id));
        if (selectedField?.id === id) setSelectedField(null);
    };

    const duplicateField = (id) => {
        const field = formFields.find(f => f.id === id);
        if (!field) return;
        const newField = { ...field, id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, label: `${field.label} (Copy)` };
        const index = formFields.findIndex(f => f.id === id);
        const newFields = [...formFields];
        newFields.splice(index + 1, 0, newField);
        setFormFields(newFields);
    };

    return { addField, updateField, deleteField, duplicateField };
};
