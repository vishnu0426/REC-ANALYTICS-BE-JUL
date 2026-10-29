import React, { useState, useEffect, useRef } from 'react';
import { Button, theme } from 'antd';

const FunctionalSignaturePad = ({ value, onChange, disabled }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const { token } = theme.useToken();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = token.colorText; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = value; }
    }, [token, value]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const startDrawing = (e) => { if (disabled) return; e.preventDefault(); setIsDrawing(true); const { x, y } = getCoordinates(e); const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(x, y); };
    const draw = (e) => { if (!isDrawing || disabled) return; const { x, y } = getCoordinates(e); const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(x, y); ctx.stroke(); };
    const stopDrawing = () => { if (isDrawing) { const canvas = canvasRef.current; const dataUrl = canvas.toDataURL(); onChange(dataUrl); setIsDrawing(false); } };
    const clear = () => { const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); onChange(null); };

    return (
        <div className="signature-pad-container" style={{ width: '100%' }}>
            <canvas
                ref={canvasRef}
                width={800}
                height={300}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onTouchStart={(e) => { if (!disabled) { startDrawing(e.touches[0]); } }}
                onTouchMove={(e) => { if (!disabled) { e.preventDefault(); draw(e.touches[0]); } }}
                onTouchEnd={stopDrawing}
                className={`signature-canvas ${disabled ? 'cursor-default' : 'cursor-crosshair'}`}
                style={{ width: '100%', height: '300px', border: `1px solid ${token.colorBorder}`, borderRadius: '8px', touchAction: 'none', background: token.colorBgContainer }}
            />
            {!disabled && <Button size="small" type="text" onClick={clear} className="signature-clear-btn" style={{ marginTop: 8 }}>Clear</Button>}
        </div>
    );
};

export default FunctionalSignaturePad;
