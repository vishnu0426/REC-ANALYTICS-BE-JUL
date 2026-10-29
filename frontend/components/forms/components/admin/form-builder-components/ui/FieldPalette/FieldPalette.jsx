import React from 'react';
import { Typography, theme as antdTheme } from 'antd';
import PaletteItem from './PaletteItem.jsx';
import { FIELD_TYPES, FIELD_CATEGORIES } from '../../constants/fieldTypes.js';

const { Text } = Typography;

const FieldPalette = ({ onDragStart, onAddField }) => {
    const { token } = antdTheme.useToken();

    return (
        <div className="builder-sidebar field-palette-sidebar" style={{
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'auto',
        }}>
            <div className="sidebar-header" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <Text strong style={{ fontSize: '14px' }}>Field Toolbox</Text>
            </div>
            <div className="sidebar-content">
                {FIELD_CATEGORIES.map(category => (
                    <div key={category.id} style={{ marginBottom: '20px' }}>
                        <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px', padding: '0 4px' }}>
                            {category.label}
                        </Text>
                        {FIELD_TYPES.filter(f => f.category === category.id).map(fieldType => (
                            <PaletteItem
                                key={fieldType.type}
                                fieldType={fieldType}
                                onDragStart={onDragStart}
                                onAdd={onAddField}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FieldPalette;
