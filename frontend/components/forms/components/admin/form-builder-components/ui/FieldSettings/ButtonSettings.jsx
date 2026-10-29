import React from 'react';
import { Input, Switch, Select, Typography } from 'antd';

const { Text } = Typography;

const ButtonSettings = ({ field, onUpdate }) => (
    <>
        <div className="button-settings-row"><Text type="secondary" className="button-settings-label">Button Label</Text><Input value={field.button_label || 'Button'} onChange={(e) => onUpdate(field.id, { button_label: e.target.value })} placeholder="Button text" /></div>
        <div className="button-settings-row"><Text type="secondary" className="button-settings-label">Button Type</Text><Select style={{ width: '100%' }} value={field.button_type || 'primary'} onChange={(val) => onUpdate(field.id, { button_type: val })}><Select.Option value="primary">Primary</Select.Option><Select.Option value="default">Default</Select.Option><Select.Option value="dashed">Dashed</Select.Option><Select.Option value="text">Text</Select.Option><Select.Option value="link">Link</Select.Option></Select></div>
        <div className="button-settings-row"><Text type="secondary" className="button-settings-label">Button Size</Text><Select style={{ width: '100%' }} value={field.button_size || 'middle'} onChange={(val) => onUpdate(field.id, { button_size: val })}><Select.Option value="large">Large</Select.Option><Select.Option value="middle">Medium</Select.Option><Select.Option value="small">Small</Select.Option></Select></div>
        <div className="button-settings-switch"><Text className="button-settings-switch-label">Danger Style</Text><Switch size="small" checked={field.button_danger || false} onChange={(val) => onUpdate(field.id, { button_danger: val })} /></div>
        <div className="button-settings-switch"><Text className="button-settings-switch-label">Full Width (Block)</Text><Switch size="small" checked={field.button_block || false} onChange={(val) => onUpdate(field.id, { button_block: val })} /></div>
        <div className="button-settings-row"><Text type="secondary" className="button-settings-label">Action Type</Text><Select style={{ width: '100%' }} value={field.button_action_type || 'submit'} onChange={(val) => onUpdate(field.id, { button_action_type: val })}><Select.Option value="submit">Submit Form</Select.Option><Select.Option value="reset">Reset Form</Select.Option><Select.Option value="url">Navigate to URL</Select.Option><Select.Option value="url_new_tab">Open URL in New Tab</Select.Option><Select.Option value="print">Print Page</Select.Option><Select.Option value="download_pdf">Download as PDF</Select.Option><Select.Option value="close">Close / Go Back</Select.Option><Select.Option value="custom">Custom Action</Select.Option></Select></div>
        {['url', 'url_new_tab'].includes(field.button_action_type) && <div className="button-settings-row"><Text type="secondary" className="button-settings-label">Target URL</Text><Input value={field.button_url || ''} onChange={(e) => onUpdate(field.id, { button_url: e.target.value })} placeholder="https://example.com" /></div>}
        {field.button_action_type === 'custom' && <div className="button-settings-row"><Text type="secondary" className="button-settings-label">Custom Action Identifier</Text><Input value={field.button_custom_id || ''} onChange={(e) => onUpdate(field.id, { button_custom_id: e.target.value })} placeholder="e.g. trigger_modal_open" /></div>}
    </>
);

export default ButtonSettings;
