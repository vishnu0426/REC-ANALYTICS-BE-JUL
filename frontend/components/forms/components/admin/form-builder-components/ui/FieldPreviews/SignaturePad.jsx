import React, { useRef, useState, useEffect } from 'react';
import { Button, theme as antdTheme } from 'antd';

const SignaturePad = ({ disabled = false }) => {
    const { token } = antdTheme.useToken();
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = token.colorText; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    }, [token]);

    const startDrawing = (e) => { if (disabled) return; setIsDrawing(true); const { offsetX, offsetY } = e.nativeEvent; const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(offsetX, offsetY); };
    const draw = (e) => { if (!isDrawing || disabled) return; const { offsetX, offsetY } = e.nativeEvent; const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(offsetX, offsetY); ctx.stroke(); };
    const stopDrawing = () => setIsDrawing(false);
    const clear = () => { const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); };

    return (
        <div style={{ position: 'relative' }}>
            <canvas ref={canvasRef} width={400} height={120} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} style={{ border: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer, cursor: disabled ? 'default' : 'crosshair', touchAction: 'none', borderRadius: '8px' }} />
            {!disabled && <Button size="small" type="text" onClick={clear} style={{ position: 'absolute', top: '8px', right: '8px' }}>Clear</Button>}
        </div>
    );
};

export default SignaturePad;
