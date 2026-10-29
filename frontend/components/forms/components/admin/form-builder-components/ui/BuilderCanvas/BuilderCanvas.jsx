import React from 'react';
import CanvasField from './CanvasField.jsx';
import EmptyCanvas from './EmptyCanvas.jsx';

const BuilderCanvas = ({
    fields, selectedField, onSelectField, onUpdateField,
    onDeleteField, onDuplicateField, onDragStart, onDragOver, onDrop,
    ghostIndex, onAddField
}) => {
    if (fields.length === 0) {
        return (
            <div className="builder-canvas-container">
                <div
                    onDragOver={(e) => onDragOver && onDragOver(0, e)}
                    onDrop={() => onDrop && onDrop(0)}
                    style={{ minHeight: '100%' }}
                >
                    {ghostIndex === 0 && <div className="ghost-drop-zone" />}
                    <EmptyCanvas onAddField={onAddField} />
                </div>
            </div>
        );
    }

    return (
        <div className="builder-canvas-container">
            <div className="canvas-fields-list">
                {fields.map((field, index) => (
                    <React.Fragment key={field.id}>
                        {ghostIndex === index && <div className="ghost-drop-zone" />}
                        <CanvasField
                            field={field}
                            index={index}
                            isSelected={selectedField?.id === field.id}
                            onSelect={() => onSelectField(field)}
                            onUpdate={onUpdateField}
                            onDelete={() => onDeleteField(field.id)}
                            onDuplicate={() => onDuplicateField(field.id)}
                            onDragStart={() => onDragStart(index)}
                            onDragOver={(e) => onDragOver(index, e)}
                            onDrop={() => onDrop(index)}
                        />
                    </React.Fragment>
                ))}
                {ghostIndex === fields.length && <div className="final-drop-zone" />}
                <div
                    className="canvas-drop-area"
                    onDragOver={(e) => onDragOver(fields.length, e)}
                    onDrop={() => onDrop(fields.length)}
                />
            </div>
        </div>
    );
};

export default BuilderCanvas;
