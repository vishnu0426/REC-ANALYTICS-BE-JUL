import React, { useState } from 'react';
import { Tag, theme, Typography } from 'antd';

const { Text } = Typography;

const CustomTagInput = ({ value = [], onChange, placeholder = "Type & press Enter..." }) => {
    const [inputValue, setInputValue] = useState('');
    const inputRef = React.useRef(null);
    const { token } = theme.useToken();

    const addTag = (val) => {
        const cleanVal = val.trim().replace(/,/g, '');
        if (cleanVal && !value.includes(cleanVal)) onChange([...value, cleanVal]);
        setInputValue('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputValue); }
        else if (e.key === 'Backspace' && !inputValue && value.length > 0) onChange(value.slice(0, -1));
    };

    const handleBlur = () => { if (inputValue) addTag(inputValue); };

    return (
        <div className="custom-tag-input-wrapper" onClick={() => inputRef.current?.focus()}>
            <div className="tags-container-inner">
                {value.map((tag, idx) => <Tag key={tag + idx} closable onClose={() => onChange(value.filter(t => t !== tag))} className="custom-tag-pill">{tag}</Tag>)}
                <input ref={inputRef} className="tag-bare-input" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleBlur} placeholder={value.length === 0 ? placeholder : ""} autoComplete="off" />
            </div>
        </div>
    );
};

export default CustomTagInput;
