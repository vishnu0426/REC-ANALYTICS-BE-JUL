import React, { useState } from 'react';
import { Drawer, Typography, Button, Upload, theme as antdTheme } from 'antd';
import { RotateCcw, Upload as UploadIcon, Palette } from 'lucide-react';
import { TinyColor } from '@ctrl/tinycolor';
import { useToast } from '../../../../../context/ToastContext.jsx';

const { Text, Title } = Typography;

const PRESET_COLORS = [
    { name: 'Black', value: '#000000' }, { name: 'Teal', value: '#14b8a6' }, { name: 'Cream', value: '#fef3c7' }, { name: 'Sky Blue', value: '#bae6fd' }, { name: 'Slate', value: '#cbd5e1' }, { name: 'Orange', value: '#fb923c' }, { name: 'Purple', value: '#a78bfa' }, { name: 'Blue', value: '#3b82f6' }, { name: 'Pink', value: '#ec4899' }, { name: 'Navy', value: '#1e3a8a' }, { name: 'Green', value: '#22c55e' }, { name: 'Red', value: '#ef4444' },
];

const PRESET_IMAGES = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1636955816868-fcb881e57954?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1604076850742-4c7221f3101b?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1618172193763-c511deb635ca?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=1200&fit=crop', 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1574169208507-84376144848b?auto=format&fit=crop&w=1000&q=80',
];

const BRAND_COLORS = [
    { name: 'Teal', value: '#14b8a6' }, { name: 'Indigo', value: '#6366f1' }, { name: 'Amber', value: '#f59e0b' }, { name: 'Emerald', value: '#10b981' }, { name: 'Rose', value: '#f43f5e' }, { name: 'Violet', value: '#8b5cf6' }, { name: 'Sky', value: '#0ea5e9' }, { name: 'Lime', value: '#84cc16' },
];

const FormThemeSettings = ({ open, onClose, theme, onChange }) => {
    const { showToast } = useToast();
    const current = theme || { mode: 'dark', backgroundColor: '#000000', backgroundImage: '', primaryColor: '#14b8a6' };
    const [customColor, setCustomColor] = useState('#000000');
    const [customBrandColor, setCustomBrandColor] = useState('#14b8a6');

    const handleColorChange = (color) => onChange({ ...current, backgroundColor: color, backgroundImage: '' });
    const handleBrandColorChange = (color) => onChange({ ...current, primaryColor: color });
    const handleImageChange = (image) => onChange({ ...current, backgroundImage: image, backgroundColor: '' });
    const handleImageUpload = (file) => { const reader = new FileReader(); reader.onload = (e) => { handleImageChange(e.target.result); showToast('Background image uploaded successfully!', 'success'); }; reader.onerror = () => showToast('Failed to upload image', 'error'); reader.readAsDataURL(file); return false; };
    const handleReset = () => { onChange({ mode: 'dark', backgroundColor: '#000000', backgroundImage: '', primaryColor: '#14b8a6' }); setCustomColor('#000000'); setCustomBrandColor('#14b8a6'); showToast('Theme reset to default', 'success'); };
    const getPreviewStyle = () => current.backgroundImage ? { backgroundImage: `url(${current.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : { backgroundColor: current.backgroundColor || '#000000' };

    return (
        <Drawer title={<div><Title level={4} className='m-0'>Form Theme Customizer</Title><Text type='secondary'>Brand the specific form with colors & layouts.</Text></div>} placement='right' onClose={onClose} open={open} size='large'>
            <div className='theme-customizer-container' style={{ '--form-primary': current.primaryColor, '--form-primary-alpha': new TinyColor(current.primaryColor).setAlpha(0.1).toRgbString() }}>
                <div className='theme-section'><div className='theme-preview-box' style={getPreviewStyle()}><Button type="primary">Button Preview</Button></div></div>
                <div className='theme-divider' />
                <div className='theme-section'><Text className='theme-section-title'>Brand Primary Color (Buttons & UI)</Text><div className='theme-color-grid'>{BRAND_COLORS.map((color) => <div key={color.value} className={`theme-color-swatch ${current.primaryColor === color.value ? 'active' : ''}`} style={{ backgroundColor: color.value }} onClick={() => handleBrandColorChange(color.value)} title={color.name} />)}<div className='theme-color-swatch custom'><input type='color' value={customBrandColor} onChange={(e) => { setCustomBrandColor(e.target.value); handleBrandColorChange(e.target.value); }} style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: 'pointer' }} /><Palette size={20} /></div></div></div>
                <div className='theme-divider' />
                <div className='theme-section'><Text className='theme-section-title'>Form Background Color</Text><div className='theme-color-grid'>{PRESET_COLORS.map((color) => <div key={color.value} className={`theme-color-swatch ${current.backgroundColor === color.value && !current.backgroundImage ? 'active' : ''}`} style={{ backgroundColor: color.value }} onClick={() => handleColorChange(color.value)} title={color.name} />)}<div className='theme-color-swatch custom'><input type='color' value={customColor} onChange={(e) => { setCustomColor(e.target.value); handleColorChange(e.target.value); }} style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: 'pointer' }} /><Palette size={20} /></div></div></div>
                <div className='theme-divider' />
                <div className='theme-section'><Text className='theme-section-title'>Background Image Overlay</Text><div className='theme-image-grid'>{PRESET_IMAGES.map((img, index) => <div key={index} className={`theme-image-option ${current.backgroundImage === img ? 'active' : ''}`} style={{ backgroundImage: `url(${img})` }} onClick={() => handleImageChange(img)} />)}<Upload accept='image/*' showUploadList={false} beforeUpload={handleImageUpload}><div className='theme-image-option upload'><div className='theme-upload-icon'><UploadIcon size={24} /></div><Text className='theme-upload-text'>Upload</Text></div></Upload></div></div>
                <div className='theme-divider' />
                <Button icon={<RotateCcw size={16} />} onClick={handleReset} className='theme-reset-btn' block size="large">Reset Theme</Button>
            </div>
        </Drawer>
    );
};

export default FormThemeSettings;
