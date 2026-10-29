import React from 'react';
import { Input, Rate, Select, Button, Radio, Checkbox, Space, Upload as AntUpload, Slider as AntSlider, Carousel, Typography, theme as antdTheme } from 'antd';
import { ThumbsUp, X, Upload as UploadIcon } from 'lucide-react';
import SignaturePad from './SignaturePad';

const { Text } = Typography;

const getCarouselHeightClass = (height) => {
    const heightValue = height || 200;
    const roundedHeight = Math.round(heightValue / 50) * 50;
    const clampedHeight = Math.max(100, Math.min(800, roundedHeight));
    return `carousel-height-${clampedHeight}`;
};

export const FieldPreview = ({ field, isPreview = false }) => {
    const { token } = antdTheme.useToken();
    switch (field.type) {
        case 'rating': return <Rate disabled={!isPreview} count={field.maxStars || 5} defaultValue={0} />;
        case 'nps': {
            const npsMin = field.nps_min || 0; const npsMax = field.nps_max || 10; const npsCount = npsMax - npsMin + 1;
            return <div className="nps-container" style={{ display: 'flex', gap: '4px' }}>{[...Array(npsCount)].map((_, i) => { const num = npsMin + i; return <div key={num} style={{ padding: '8px 0', textAlign: 'center', background: `color-mix(in srgb, ${token.colorPrimary}, transparent 90%)`, border: `1px solid ${token.colorBorderSecondary}`, borderColor: `color-mix(in srgb, ${token.colorPrimary}, transparent 70%)`, color: token.colorPrimary, borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: isPreview ? 'pointer' : 'default', flex: 1, minWidth: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{num}</div>; })}</div>;
        }
        case 'yesno': return <Space size="large"><Button shape="round" icon={<ThumbsUp size={14} />} disabled={!isPreview} style={{ borderColor: '#12805A', color: '#12805A' }}>Yes</Button><Button shape="round" icon={<X size={14} />} disabled={!isPreview} style={{ borderColor: '#C1352E', color: '#C1352E' }}>No</Button></Space>;
        case 'segmented': return <div style={{ display: 'flex', background: token.colorBgLayout, padding: '4px', borderRadius: '8px', gap: '4px' }}>{field.options?.map((opt, i) => { const label = typeof opt === 'object' ? opt.label : opt; return <div key={i} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: '13px', borderRadius: '6px', background: i === 0 ? token.colorBgContainer : 'transparent', boxShadow: i === 0 ? token.boxShadowTertiary : 'none', cursor: isPreview ? 'pointer' : 'default' }}>{label}</div>; })}</div>;
        case 'upload': return <AntUpload.Dragger disabled={!isPreview} action="/api/upload-placeholder" multiple={false} style={{ background: token.colorBgContainer }}><p className="ant-upload-drag-icon"><UploadIcon size={24} style={{ color: token.colorPrimary }} /></p><p className="ant-upload-text" style={{ fontSize: '13px' }}>Click or drag file to upload</p><p className="ant-upload-hint" style={{ fontSize: '11px' }}>Support for a single or bulk upload.</p></AntUpload.Dragger>;
        case 'signature': return <SignaturePad disabled={!isPreview} />;
        case 'slider': return <div className="slider-field-wrapper" style={{ padding: '0 8px', width: '100%', display: 'flex', flexDirection: 'column' }}><AntSlider disabled={!isPreview} min={field.min || 0} max={field.max || 100} step={field.step || 1} defaultValue={field.min || 0} trackStyle={{ backgroundColor: token.colorPrimary }} handleStyle={{ borderColor: token.colorPrimary }} style={{ width: '100%', margin: '14px 6px' }} /><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: token.colorTextSecondary, marginTop: '4px' }}><span>{field.min || 0}</span><span>{field.max || 100}</span></div></div>;
        case 'dropdown': return <Select placeholder={field.placeholder} style={{ width: '100%' }} disabled={!isPreview}>{field.options?.map((opt, i) => { const label = typeof opt === 'object' ? opt.label : opt; const value = typeof opt === 'object' ? opt.value : opt; return <Select.Option key={i} value={value}>{label}</Select.Option>; })}</Select>;
        case 'radio': return <Radio.Group disabled={!isPreview} style={{ display: 'flex', flexDirection: field.layout === 'horizontal' ? 'row' : 'column', gap: field.layout === 'horizontal' ? '16px' : '8px' }}>{field.options?.map((opt, i) => { const label = typeof opt === 'object' ? opt.label : opt; const value = typeof opt === 'object' ? opt.value : opt; return <Radio key={i} value={value}><span style={{ color: token.colorTextSecondary }}>{label}</span></Radio>; })}</Radio.Group>;
        case 'checkbox': return <Checkbox.Group disabled={!isPreview} style={{ display: 'flex', flexDirection: field.layout === 'horizontal' ? 'row' : 'column', gap: field.layout === 'horizontal' ? '16px' : '8px' }}>{field.options?.map((opt, i) => { const label = typeof opt === 'object' ? opt.label : opt; const value = typeof opt === 'object' ? opt.value : opt; return <Checkbox key={i} value={value}><span style={{ color: token.colorTextSecondary }}>{label}</span></Checkbox>; })}</Checkbox.Group>;
        case 'textarea': return <Input.TextArea placeholder={field.placeholder} rows={3} readOnly={!isPreview} />;
        case 'date': return <Input type="date" style={{ width: '100%' }} readOnly={!isPreview} />;
        case 'time': return <Input type="time" style={{ width: '100%' }} readOnly={!isPreview} />;
        case 'button': {
            const handleButtonClick = () => { if (!isPreview) return; const actionType = field.button_action_type || 'submit'; const url = field.button_url; switch (actionType) { case 'url': if (url) window.location.href = url; break; case 'url_new_tab': if (url) window.open(url, '_blank'); break; case 'submit': console.log('Form submit action triggered'); break; case 'reset': console.log('Form reset action triggered'); break; case 'print': window.print(); break; case 'download_pdf': console.log('Downloading form as PDF...'); break; case 'close': console.log('Closing form...'); window.history.back(); break; case 'custom': console.log(`Custom Action Triggered: ${field.button_custom_id || 'no_id_set'}`); break; } };
            const btnType = field.button_type || 'primary'; const isPrimaryBtn = btnType === 'primary';
            const buttonStyles = isPreview && isPrimaryBtn && !field.button_danger ? { backgroundColor: token.colorPrimary, borderColor: token.colorPrimary, color: '#fff', textDecoration: 'none' } : { textDecoration: 'none' };
            return <div className={`field-preview-button-wrapper ${field.button_block ? 'full-width' : ''}`}><Button type={btnType} size={field.button_size || 'middle'} danger={field.button_danger || false} block={field.button_block || false} disabled={!isPreview} onClick={handleButtonClick} style={buttonStyles}>{field.button_label || field.label || 'Button'}</Button></div>;
        }
        case 'carousel': {
            const carouselProps = { autoplay: field.autoplay !== false, autoplaySpeed: field.autoplaySpeed || 3000, dots: field.dots !== false, dotPosition: field.dotPosition || 'bottom', effect: field.effect || 'scrollx', speed: field.speed || 500, infinite: field.infinite !== false, draggable: field.draggable !== false, pauseOnHover: field.pauseOnHover !== false, adaptiveHeight: field.adaptiveHeight || false, slidesToShow: field.slidesToShow || 1, slidesToScroll: field.slidesToScroll || 1, centerMode: field.centerMode || false, vertical: field.vertical || false, verticalSwiping: field.vertical || false };
            const validImages = (field.images || []).filter((img) => img && img.trim() !== '');
            if (validImages.length === 0) { const placeholderHeight = field.carouselHeight || 200; const heightClass = getCarouselHeightClass(placeholderHeight); return <div className={`carousel-placeholder ${heightClass}`}><Text type="secondary" className="carousel-placeholder-text">No images added to carousel</Text></div>; }
            const carouselHeight = field.carouselHeight || 200; const heightClass = getCarouselHeightClass(carouselHeight); const modeClass = isPreview ? 'preview-mode' : 'canvas-mode';
            React.useEffect(() => { const timer = setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 500); return () => clearTimeout(timer); }, [field.id, isPreview, field.vertical, field.dotPosition]);
            return <div className={`carousel-preview-wrapper ${heightClass} ${modeClass}`} style={{ height: carouselHeight, overflow: 'hidden' }}><Carousel key={`${field.id}-${field.vertical}-${field.dotPosition}-${field.effect}-${validImages.length}-${isPreview}`} {...carouselProps} style={{ height: carouselHeight }}>{validImages.map((src, idx) => <div key={idx} style={{ height: carouselHeight }}><div className="carousel-slide-container" style={{ height: carouselHeight }}><img src={src} alt={field.label || `Slide ${idx + 1}`} className="carousel-slide-image" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.target.classList.add('carousel-image-error'); }} /></div></div>)}</Carousel></div>;
        }
        default: return <Input type={field.type} placeholder={field.placeholder} readOnly={!isPreview} />;
    }
};

export const renderFieldPreview = (field, isPreview = false) => <FieldPreview field={field} isPreview={isPreview} />;
