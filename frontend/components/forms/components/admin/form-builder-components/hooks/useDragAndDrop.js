import { useState } from 'react';

export const useDragAndDrop = (formFields, setFormFields, addField) => {
    const [dragSource, setDragSource] = useState(null);
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [ghostIndex, setGhostIndex] = useState(null);

    const handleDragStart = (index) => {
        setDragSource('canvas');
        setDraggedIndex(index);
    };

    const handlePaletteDragStart = (fieldType) => {
        setDragSource('palette');
        setDraggedIndex(fieldType);
    };

    const handleDragOver = (index, e) => {
        e.preventDefault();
        if (dragSource === 'canvas' && draggedIndex !== null && index !== draggedIndex) {
            setGhostIndex(index);
        } else if (dragSource === 'palette') {
            setGhostIndex(index);
        }
    };

    const handleCanvasDrop = (index) => {
        if (dragSource === 'palette') {
            addField(draggedIndex, index);
        } else if (dragSource === 'canvas' && draggedIndex !== null) {
            const newFields = [...formFields];
            const [removed] = newFields.splice(draggedIndex, 1);
            newFields.splice(index, 0, removed);
            setFormFields(newFields);
        }
        setDragSource(null);
        setDraggedIndex(null);
        setGhostIndex(null);
    };

    return { handleDragStart, handlePaletteDragStart, handleDragOver, handleCanvasDrop, ghostIndex };
};
