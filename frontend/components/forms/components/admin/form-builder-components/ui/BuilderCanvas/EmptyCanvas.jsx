import React from 'react';
import { Button, Empty } from 'antd';
import { Plus } from 'lucide-react';

const EmptyCanvas = ({ onAddField }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            border: '2px dashed #d9d9d9',
            borderRadius: '12px',
            background: '#fafafa',
        }}>
            <Empty description="No fields yet. Drag elements from the palette or click below to start." />
            <Button type="primary" icon={<Plus size={16} />} onClick={onAddField} style={{ marginTop: 16 }}>
                Add First Element
            </Button>
        </div>
    );
};

export default EmptyCanvas;
