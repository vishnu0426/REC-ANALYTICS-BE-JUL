export const getDefaultField = (type) => {
    const id = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const base = { id, type, label: `New ${type} field`, description: '', placeholder: '', required: false, borderStyle: 'bordered', alignment: 'left' };

    switch (type) {
        case 'text': return { ...base };
        case 'textarea': return { ...base };
        case 'number': return { ...base };
        case 'email': return { ...base };
        case 'rating': return { ...base, maxStars: 5, star_scores: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 }, max_score: 10 };
        case 'nps': return { ...base, nps_min: 0, nps_max: 10, nps_scores: { 0: 0, 1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 7: 70, 8: 80, 9: 90, 10: 100 }, max_score: 10 };
        case 'yesno': return { ...base, yes_score: 10, no_score: 0, max_score: 10 };
        case 'segmented': return { ...base, options: [{ label: 'Low', value: 'low', score: 3 }, { label: 'Medium', value: 'medium', score: 6 }, { label: 'High', value: 'high', score: 10 }], max_score: 10 };
        case 'slider': return { ...base, min: 0, max: 100, step: 1, max_score: 10 };
        case 'dropdown': return { ...base, options: [{ label: 'Option 1', value: 'option_1', score: 5 }, { label: 'Option 2', value: 'option_2', score: 10 }], max_score: 10 };
        case 'radio': return { ...base, options: [{ label: 'Option 1', value: 'option_1', score: 5 }, { label: 'Option 2', value: 'option_2', score: 10 }], layout: 'vertical', max_score: 10 };
        case 'checkbox': return { ...base, options: [{ label: 'Option 1', value: 'option_1', score: 5 }, { label: 'Option 2', value: 'option_2', score: 10 }], layout: 'vertical', max_score: 10 };
        case 'date': return { ...base };
        case 'time': return { ...base };
        case 'upload': return { ...base };
        case 'signature': return { ...base };
        case 'carousel': return { ...base, images: [], carouselHeight: 200, autoplay: true, autoplaySpeed: 3000, dots: true, dotPosition: 'bottom', effect: 'scrollx', speed: 500, infinite: true, draggable: true, pauseOnHover: true, adaptiveHeight: false, centerMode: false, vertical: false, slidesToShow: 1, slidesToScroll: 1 };
        case 'button': return { ...base, button_label: 'Button', button_type: 'primary', button_size: 'middle', button_danger: false, button_block: false, button_action_type: 'submit', button_url: '', button_custom_id: '' };
        default: return base;
    }
};

export const isScorableField = (type) => {
    // Only these field types take part in scoring. Text-like fields (text,
    // textarea, number, email) and non-input fields (upload, signature,
    // carousel, button, date, time) never contribute points.
    return ['rating', 'nps', 'yesno', 'segmented', 'slider', 'dropdown', 'radio', 'checkbox'].includes(type);
};

export const hasOptions = (type) => {
    return ['dropdown', 'radio', 'checkbox', 'segmented'].includes(type);
};

/**
 * Auto-redistribute scores when one field's max_score changes.
 * Keeps the form's total = totalScore by proportionally adjusting the
 * OTHER scorable fields (preserving their relative weights).
 *
 * Example: total=100, ten 10-point fields. Field #2 changes 10 -> 5:
 *   remaining = 95 spread across the other 9 fields (~10.55 each).
 * Change 10 -> 15: remaining = 85 spread across the other 9 (~9.44 each).
 */
export const redistributeScores = (fields, changedFieldId, newMaxScore, totalScore) => {
    const scorable = fields.filter(f => isScorableField(f.type));
    const others = scorable.filter(f => f.id !== changedFieldId);

    // No other scorable fields — just set the value
    if (others.length === 0) {
        return fields.map(f => f.id === changedFieldId ? { ...f, max_score: newMaxScore } : f);
    }

    const remaining = Math.max(0, totalScore - newMaxScore);
    const othersSum = others.reduce((sum, f) => sum + (Number(f.max_score) || 0), 0);

    const newScores = {};
    if (othersSum > 0) {
        // Proportional redistribution — preserves relative weight of each field
        let assigned = 0;
        others.forEach((f, idx) => {
            if (idx === others.length - 1) {
                // Last field absorbs rounding remainder so sum === remaining exactly
                newScores[f.id] = Math.max(0, remaining - assigned);
            } else {
                const val = Math.round((Number(f.max_score) || 0) / othersSum * remaining);
                newScores[f.id] = Math.max(0, val);
                assigned += val;
            }
        });
    } else {
        // Equal split fallback when others have no scores yet
        const base = Math.floor(remaining / others.length);
        let remainder = remaining - base * others.length;
        others.forEach(f => {
            newScores[f.id] = base + (remainder-- > 0 ? 1 : 0);
        });
    }

    return fields.map(f => {
        if (f.id === changedFieldId) return { ...f, max_score: newMaxScore };
        if (newScores[f.id] !== undefined) return { ...f, max_score: newScores[f.id] };
        return f;
    });
};

/**
 * Rescale ALL scorable fields proportionally when the form's Total Max Score changes.
 * E.g. total 100 -> 50 halves every field's max_score.
 */
export const rescaleFieldsToTotal = (fields, newTotal) => {
    const scorable = fields.filter(f => isScorableField(f.type));
    if (scorable.length === 0) return fields;

    const oldTotal = scorable.reduce((sum, f) => sum + (Number(f.max_score) || 0), 0);

    const newScores = {};
    if (oldTotal <= 0) {
        // No existing scores — equal split
        const base = Math.floor(newTotal / scorable.length);
        let remainder = newTotal - base * scorable.length;
        scorable.forEach(f => {
            newScores[f.id] = base + (remainder-- > 0 ? 1 : 0);
        });
    } else {
        // Proportional scale; last field absorbs rounding remainder
        let assigned = 0;
        scorable.forEach((f, idx) => {
            if (idx === scorable.length - 1) {
                newScores[f.id] = Math.max(0, newTotal - assigned);
            } else {
                const val = Math.round((Number(f.max_score) || 0) / oldTotal * newTotal);
                newScores[f.id] = Math.max(0, val);
                assigned += val;
            }
        });
    }

    return fields.map(f => newScores[f.id] !== undefined ? { ...f, max_score: newScores[f.id] } : f);
};

export const getDefaultFormContent = () => {
    return {
        fields: [],
        total_score: 100,
        hasScoring: true,
        theme: { backgroundColor: '#000000', backgroundImage: '' },
    };
};
