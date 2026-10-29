import React from 'react';
import { Input, InputNumber, Button, Switch, Select, Typography } from 'antd';
import { Plus, Trash2 } from 'lucide-react';

const { Text } = Typography;

const CarouselSettings = ({ field, onUpdate }) => {
    const addImage = () => onUpdate(field.id, { images: [...(field.images || []), ''] });
    const updateImage = (index, value) => { const newImages = [...(field.images || [])]; newImages[index] = value; onUpdate(field.id, { images: newImages }); };
    const removeImage = (index) => onUpdate(field.id, { images: (field.images || []).filter((_, i) => i !== index) });

    return (
        <>
            <div>
                <div className="carousel-settings-header"><Text type="secondary" className="carousel-settings-label">Image URLs</Text><Button type="dashed" size="small" icon={<Plus size={12} />} onClick={addImage}>Add Image</Button></div>
                <div className="carousel-image-grid">
                    {(field.images || []).map((img, index) => (
                        <div key={index}>
                            <div className="carousel-image-row"><Input className="carousel-image-input" placeholder="https://example.com/image.jpg" value={img} onChange={(e) => updateImage(index, e.target.value)} /><Button icon={<Trash2 size={14} />} danger type="text" size="small" onClick={() => removeImage(index)} /></div>
                            {img && img.trim() && <div className="carousel-image-preview"><img src={img} alt={`Preview ${index + 1}`} onError={(e) => { e.target.classList.add('carousel-image-error'); }} /></div>}
                        </div>
                    ))}
                </div>
            </div>
            <div className="carousel-setting-row"><Text type="secondary" className="carousel-setting-label">Carousel Height (px)</Text><InputNumber className="carousel-full-width" min={100} max={800} value={field.carouselHeight || 200} onChange={(val) => onUpdate(field.id, { carouselHeight: val || 200 })} /></div>
            <div className="carousel-config-section">
                <Text strong className="carousel-config-title">Carousel Configuration</Text>
                <div className="carousel-setting-switch"><Text className="carousel-setting-label">Autoplay</Text><Switch size="small" checked={field.autoplay !== false} onChange={(val) => onUpdate(field.id, { autoplay: val })} /></div>
                {field.autoplay !== false && <div className="carousel-setting-row"><Text type="secondary" className="carousel-setting-label">Autoplay Speed (ms)</Text><InputNumber className="carousel-full-width" min={1000} max={10000} step={500} value={field.autoplaySpeed || 3000} onChange={(val) => onUpdate(field.id, { autoplaySpeed: val || 3000 })} /></div>}
                <div className="carousel-setting-switch"><Text className="carousel-setting-label">Show Navigation Dots</Text><Switch size="small" checked={field.dots !== false} onChange={(val) => onUpdate(field.id, { dots: val })} /></div>
                {field.dots !== false && <div className="carousel-setting-row"><Text type="secondary" className="carousel-setting-label">Dots Position</Text><Select className="carousel-full-width" value={field.dotPosition || 'bottom'} onChange={(val) => onUpdate(field.id, { dotPosition: val })}><Select.Option value="top">Top</Select.Option><Select.Option value="bottom">Bottom</Select.Option><Select.Option value="left">Left</Select.Option><Select.Option value="right">Right</Select.Option></Select></div>}
                <div className="carousel-setting-row"><Text type="secondary" className="carousel-setting-label">Transition Effect</Text><Select className="carousel-full-width" value={field.effect || 'scrollx'} onChange={(val) => onUpdate(field.id, { effect: val })}><Select.Option value="scrollx">Scroll</Select.Option><Select.Option value="fade">Fade</Select.Option></Select></div>
                <div className="carousel-setting-row"><Text type="secondary" className="carousel-setting-label">Transition Speed (ms)</Text><InputNumber className="carousel-full-width" min={100} max={3000} step={100} value={field.speed || 500} onChange={(val) => onUpdate(field.id, { speed: val || 500 })} /></div>
                <div className="carousel-setting-switch"><Text className="carousel-setting-label">Infinite Loop</Text><Switch size="small" checked={field.infinite !== false} onChange={(val) => onUpdate(field.id, { infinite: val })} /></div>
                <div className="carousel-setting-switch"><Text className="carousel-setting-label">Draggable/Swipeable</Text><Switch size="small" checked={field.draggable !== false} onChange={(val) => onUpdate(field.id, { draggable: val })} /></div>
                <div className="carousel-setting-switch"><Text className="carousel-setting-label">Pause on Hover</Text><Switch size="small" checked={field.pauseOnHover !== false} onChange={(val) => onUpdate(field.id, { pauseOnHover: val })} /></div>
                <div className="carousel-setting-switch"><Text className="carousel-setting-label">Adaptive Height</Text><Switch size="small" checked={field.adaptiveHeight || false} onChange={(val) => onUpdate(field.id, { adaptiveHeight: val })} /></div>
                <div className="carousel-setting-switch"><Text className="carousel-setting-label">Center Mode</Text><Switch size="small" checked={field.centerMode || false} onChange={(val) => onUpdate(field.id, { centerMode: val })} /></div>
                <div className="carousel-setting-switch"><Text className="carousel-setting-label">Vertical Mode</Text><Switch size="small" checked={field.vertical || false} onChange={(val) => onUpdate(field.id, { vertical: val })} /></div>
                <div className="carousel-setting-row"><Text type="secondary" className="carousel-setting-label">Slides to Show</Text><InputNumber className="carousel-full-width" min={1} max={5} value={field.slidesToShow || 1} onChange={(val) => onUpdate(field.id, { slidesToShow: val || 1 })} /></div>
                <div className="carousel-setting-row"><Text type="secondary" className="carousel-setting-label">Slides to Scroll</Text><InputNumber className="carousel-full-width" min={1} max={5} value={field.slidesToScroll || 1} onChange={(val) => onUpdate(field.id, { slidesToScroll: val || 1 })} /></div>
            </div>
        </>
    );
};

export default CarouselSettings;
