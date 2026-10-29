import React from 'react';
import { Button, Tooltip, Typography, Space, Empty, Spin, theme as antdTheme } from 'antd';
import { FolderOpen, Plus } from 'lucide-react';
import FormCard from './FormCard.jsx';

const { Title, Text } = Typography;

const FormsLibrary = ({ forms, selectedForm, onSelectForm, onDelete, onCreate, loading }) => {
    const { token } = antdTheme.useToken();
    if (loading && !forms) return <div className="builder-sidebar forms-library-sidebar" style={{ background: token.colorBgContainer, padding: '40px', justifyContent: 'center', alignItems: 'center' }}><Spin size="large" /></div>;
    return (
        <div className="builder-sidebar forms-library-sidebar" style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}` }}>
            <div className="sidebar-header" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}><Space><FolderOpen size={18} style={{ color: token.colorPrimary }} /><Title level={5} style={{ margin: 0, fontSize: '16px' }}>Forms Library</Title></Space><Tooltip title="Create New Form"><Button type="primary" shape="circle" size="small" icon={<Plus size={14} />} onClick={onCreate} /></Tooltip></div>
            <div className="sidebar-content">
                {forms?.map(form => <FormCard key={form.id} form={form} isSelected={selectedForm?.id === form.id} onSelect={onSelectForm} onDelete={onDelete} />)}
                {(!forms || forms.length === 0) && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">No forms found</Text>} style={{ marginTop: '40px' }} />}
            </div>
        </div>
    );
};

export default FormsLibrary;
