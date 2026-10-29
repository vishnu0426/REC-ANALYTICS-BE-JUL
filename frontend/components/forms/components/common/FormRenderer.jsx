import React from 'react';
import { Input, InputNumber, Rate, Radio, Segmented, Button, Checkbox, Select, Slider as AntSlider, DatePicker, TimePicker, Upload as AntUpload, Typography, Carousel, theme } from 'antd';
import { LikeOutlined, DislikeOutlined, UploadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useToast } from '../../context/ToastContext.jsx';
import FunctionalSignaturePad from './FunctionalSignaturePad.jsx';
import dayjs from 'dayjs';

const { Text } = Typography;

const getCarouselHeightClass = (height) => {
    const heightValue = height || 200;
    const roundedHeight = Math.round(heightValue / 50) * 50;
    const clampedHeight = Math.max(100, Math.min(800, roundedHeight));
    return `carousel-height-${clampedHeight}`;
};

const FormRenderer = ({ fields, responses, readOnly = false, onChange, formTheme, onSubmit, onReset }) => {
    const { token } = theme.useToken();
    const { showToast } = useToast();
    if (!fields) return null;

    // Card treatment mirrors PreviewModal: light forms get near-white cards
    // with a hairline border, dark forms subtle white-translucent cards —
    // otherwise the plain .field-card wash is invisible on light backgrounds.
    const themeBg = formTheme?.backgroundColor || '';
    const isDarkBg = Boolean(formTheme?.backgroundImage) || (() => {
        const hex = themeBg.replace('#', '');
        if (hex.length !== 6) return false;
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
    })();
    const cardStyle = {
        background: isDarkBg ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.75)',
        border: isDarkBg ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.06)',
    };
    const textColor = isDarkBg ? 'rgba(255, 255, 255, 0.92)' : undefined;
    const textSecondaryColor = isDarkBg ? 'rgba(255, 255, 255, 0.65)' : undefined;

    const getValue = (fieldId) => responses ? responses[fieldId] : undefined;

    return (
        <div className='form-renderer-container'>
            {fields.map((field) => (
                <div key={field.id} className={`field-card eval-field-container ${field.borderStyle === 'borderless' ? 'borderless' : ''} ${field.alignment ? `align-${field.alignment}` : 'align-left'}`} style={field.borderStyle === 'borderless' ? undefined : cardStyle}>
                    <div className='field-card-header mb-2'>
                        <Text strong className='text-sm' style={{ color: textColor }}>{field.label}{' '}{field.required && !readOnly && <span style={{ color: '#ff4d4f', marginLeft: '4px' }}>*</span>}</Text>
                        {field.description && <Text type='secondary' className='eval-field-desc' style={{ color: textSecondaryColor }}>{field.description}</Text>}
                    </div>
                    {field.type === 'text' && <Input placeholder={field.placeholder} value={responses[field.id]} disabled={readOnly} onChange={(e) => onChange?.(field.id, e.target.value)} />}
                    {field.type === 'textarea' && <Input.TextArea rows={3} placeholder={field.placeholder} value={responses[field.id]} disabled={readOnly} onChange={(e) => onChange?.(field.id, e.target.value)} />}
                    {field.type === 'number' && <InputNumber className='w-full' placeholder={field.placeholder} value={responses[field.id]} disabled={readOnly} onChange={(val) => onChange?.(field.id, val)} />}
                    {field.type === 'email' && <Input type='email' placeholder={field.placeholder} value={responses[field.id]} disabled={readOnly} onChange={(e) => onChange?.(field.id, e.target.value)} />}
                    {field.type === 'rating' && <Rate count={field.maxStars || 5} value={responses[field.id]} disabled={readOnly} onChange={(val) => onChange?.(field.id, val)} />}
                    {field.type === 'yesno' && (
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {/* Unselected by default; green once Yes is picked, red once No is picked. */}
                            <Button
                                shape='round'
                                icon={<LikeOutlined />}
                                disabled={readOnly}
                                onClick={() => onChange?.(field.id, responses[field.id] === 'Yes' ? undefined : 'Yes')}
                                style={responses[field.id] === 'Yes'
                                    ? { backgroundColor: '#12805A', borderColor: '#12805A', color: '#fff' }
                                    : { borderColor: '#12805A', color: '#12805A' }}
                            >
                                Yes
                            </Button>
                            <Button
                                shape='round'
                                icon={<DislikeOutlined />}
                                disabled={readOnly}
                                onClick={() => onChange?.(field.id, responses[field.id] === 'No' ? undefined : 'No')}
                                style={responses[field.id] === 'No'
                                    ? { backgroundColor: '#C1352E', borderColor: '#C1352E', color: '#fff' }
                                    : { borderColor: '#C1352E', color: '#C1352E' }}
                            >
                                No
                            </Button>
                        </div>
                    )}
                    {field.type === 'segmented' && <Segmented options={(field.options || ['Low', 'Medium', 'High']).map((opt) => typeof opt === 'object' ? { label: opt.label, value: opt.value } : opt)} value={responses[field.id]} disabled={readOnly} onChange={(val) => onChange?.(field.id, val)} />}
                    {field.type === 'nps' && (
                        <div className='nps-container'>
                            {[...Array((field.nps_max || 10) - (field.nps_min || 0) + 1)].map((_, i) => {
                                const num = (field.nps_min || 0) + i;
                                return <Button key={num} size='small' type={responses[field.id] === num ? 'primary' : 'default'} disabled={readOnly} onClick={() => onChange?.(field.id, num)} className='nps-btn'>{num}</Button>;
                            })}
                        </div>
                    )}
                    {field.type === 'checkbox' && <Checkbox.Group options={(field.options || []).map((opt) => typeof opt === 'object' ? { label: opt.label, value: opt.value } : opt)} value={responses[field.id]} disabled={readOnly} onChange={(vals) => onChange?.(field.id, vals)} style={{ display: 'flex', flexDirection: field.layout === 'horizontal' ? 'row' : 'column', gap: '8px' }} />}
                    {field.type === 'radio' && <Radio.Group options={(field.options || []).map((opt) => typeof opt === 'object' ? { label: opt.label, value: opt.value } : opt)} value={responses[field.id]} disabled={readOnly} onChange={(e) => onChange?.(field.id, e.target.value)} style={{ display: 'flex', flexDirection: field.layout === 'horizontal' ? 'row' : 'column', gap: '8px' }} />}
                    {field.type === 'dropdown' && <Select className='w-full' options={field.options?.map((o) => typeof o === 'object' ? { label: o.label, value: o.value } : { label: o, value: o })} value={responses[field.id]} disabled={readOnly} onChange={(val) => onChange?.(field.id, val)} />}
                    {field.type === 'slider' && <AntSlider min={field.min || 0} max={field.max || 100} step={field.step || 1} value={responses[field.id] || field.min || 0} disabled={readOnly} onChange={(val) => onChange?.(field.id, val)} />}
                    {field.type === 'date' && <DatePicker className='w-full' value={responses[field.id] ? dayjs(responses[field.id]) : null} disabled={readOnly} onChange={(date, dateStr) => onChange?.(field.id, dateStr)} />}
                    {field.type === 'time' && <TimePicker className='w-full' value={responses[field.id] ? dayjs(responses[field.id], 'HH:mm:ss') : null} disabled={readOnly} onChange={(time, timeStr) => onChange?.(field.id, timeStr)} format='HH:mm:ss' />}
                    {field.type === 'upload' && (
                        <div className='w-full'>
                            <AntUpload.Dragger multiple={false} disabled={readOnly} beforeUpload={(file) => { const isLt2M = file.size / 1024 / 1024 < 2; if (!isLt2M) { showToast('File must be smaller than 2MB!', 'error'); return AntUpload.LIST_IGNORE; } return false; }} onChange={(info) => { if (readOnly) return; if (info.fileList.length > 0) { const file = info.fileList[0].originFileObj; if (file) { const reader = new FileReader(); reader.onload = () => { onChange?.(field.id, { name: file.name, data: reader.result }); }; reader.readAsDataURL(file); } } else { onChange?.(field.id, null); } }} fileList={responses[field.id] ? [{ uid: '-1', name: responses[field.id].name, status: 'done' }] : []} onRemove={() => !readOnly && onChange?.(field.id, null)} style={{ backgroundColor: token.colorBgContainer }}>
                                <p className='ant-upload-drag-icon'><UploadOutlined className='upload-icon' style={{ color: token.colorPrimary }} /></p>
                                <p className='ant-upload-text text-sm'>Click or drag file to this area to upload</p>
                                <p className='ant-upload-hint text-xs'>Support for a single image/document. Max size: 2MB (Optimized).</p>
                            </AntUpload.Dragger>
                            {responses[field.id] && (
                                readOnly && String(responses[field.id].data || '').startsWith('data:')
                                    ? <a href={responses[field.id].data} target='_blank' rel='noreferrer' className='text-xs mt-2 block' style={{ color: token.colorPrimary }}>
                                        <CheckCircleOutlined /> {responses[field.id].name || 'Open attached file'}
                                    </a>
                                    : <Text type='success' className='text-xs mt-2 block'><CheckCircleOutlined /> File attached: {responses[field.id].name}</Text>
                            )}
                        </div>
                    )}
                    {field.type === 'signature' && <FunctionalSignaturePad value={responses[field.id]} onChange={(val) => onChange?.(field.id, val)} disabled={readOnly} />}
                    {field.type === 'button' && <Button type={field.button_type || 'primary'} size={field.button_size || 'middle'} danger={field.button_danger || false} block={field.button_block || false} onClick={() => { const actionType = field.button_action_type || 'submit'; const url = field.button_url; switch (actionType) { case 'submit': onSubmit?.(); break; case 'reset': onReset?.(); break; case 'print': window.print(); break; case 'url': if (url) window.location.href = url; break; case 'url_new_tab': if (url) window.open(url, '_blank'); break; case 'close': window.history.back(); break; default: break; } }} style={{ ...(((field.button_type || 'primary') === 'primary' && !field.button_danger) ? { backgroundColor: token.colorPrimary, borderColor: token.colorPrimary, color: '#fff' } : {}), textDecoration: 'none' }}>{field.button_label || field.label || 'Button'}</Button>}
                    {field.type === 'carousel' && (
                        <div className={`carousel-preview-wrapper ${getCarouselHeightClass(field.carouselHeight || 200)}`} style={{ height: field.carouselHeight || 200, overflow: 'hidden' }}>
                            <Carousel autoplay={field.autoplay !== false} autoplaySpeed={field.autoplaySpeed || 3000} dots={field.dots !== false} dotPosition={field.dotPosition || 'bottom'} effect={field.effect || 'scrollx'} speed={field.speed || 500} infinite={field.infinite !== false} draggable={field.draggable !== false} pauseOnHover={field.pauseOnHover !== false} adaptiveHeight={field.adaptiveHeight || false} slidesToShow={field.slidesToShow || 1} slidesToScroll={field.slidesToScroll || 1} centerMode={field.centerMode || false} vertical={field.vertical || false} verticalSwiping={field.vertical || false}>
                                {(field.images || []).filter((img) => img && img.trim() !== '').map((src, idx) => (
                                    <div key={idx} style={{ height: field.carouselHeight || 200 }}>
                                        <div className="carousel-slide-container" style={{ height: '100%', width: '100%' }}>
                                            <img src={src} alt={`Slide ${idx + 1}`} className="carousel-slide-image" loading="lazy" onError={(e) => { e.target.classList.add('carousel-image-error'); }} />
                                        </div>
                                    </div>
                                ))}
                            </Carousel>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default FormRenderer;
