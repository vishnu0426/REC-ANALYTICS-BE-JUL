// Scoring rules shared by the public form-fill page (FormRendererPage) and
// the call QA Scorecard's Evaluation Forms tab.
//
// Model: each scorable field has a WEIGHT (field.max_score — maintained by the
// builder so all weights sum to the form's total_score). A field's answer is
// converted to a fraction of that field's best possible answer, multiplied by
// its weight. So:
//   - a perfect answer on every field = total_score exactly,
//   - the score can never exceed total_score,
//   - and NPS/rating raw scales (up to 100) can't blow past the form total.
// Fields without a weight (legacy data) fall back to their raw point value,
// and the final score is clamped/normalized to total_score as a safety net.

// Required-field check used before any submit: returns the labels of fields
// marked required that are still unanswered (empty string / null / undefined
// / empty array count as unanswered).
export const getMissingRequiredFields = (fields, responses) =>
    (fields || [])
        .filter((field) => {
            if (!field.required) return false;
            if (field.type === 'button') return false; // action control, not an answer
            const value = responses?.[field.id];
            if (value === undefined || value === null || value === '') return true;
            if (Array.isArray(value) && value.length === 0) return true;
            return false;
        })
        .map((field) => field.label);

// Raw points an answer earns on the field's own scale (0 for non-scorable).
const rawFieldValue = (field, val) => {
    switch (field.type) {
        case 'rating':
            return field.star_scores?.[val] ?? val * 2 ?? 0;
        case 'nps':
            return field.nps_scores?.[val] ?? val * 10 ?? 0;
        case 'yesno':
            return val === 'Yes' ? (field.yes_score || 10) : (field.no_score || 0);
        case 'segmented':
        case 'radio':
        case 'dropdown': {
            const opt = field.options?.find((o) => (typeof o === 'object' ? o.value : o) === val);
            return typeof opt === 'object' ? opt.score || 0 : 0;
        }
        case 'checkbox':
            if (Array.isArray(val)) {
                return val.reduce((sum, v) => {
                    const opt = field.options?.find((o) => (typeof o === 'object' ? o.value : o) === v);
                    return sum + (typeof opt === 'object' ? opt.score || 0 : 0);
                }, 0);
            }
            return 0;
        case 'slider': {
            const num = Number(val);
            if (Number.isNaN(num)) return 0;
            const min = Number(field.min) || 0;
            const max = Number(field.max) || 100;
            if (max <= min) return num;
            // fraction of the slider range (min answers 0)
            return Math.max(0, Math.min(1, (num - min) / (max - min)));
        }
        default:
            // text / textarea / number / email / upload / signature /
            // carousel / button / date / time never score.
            return 0;
    }
};

// Best possible raw points on the field's own scale.
const maxRawFieldValue = (field) => {
    switch (field.type) {
        case 'rating': {
            const scores = Object.values(field.star_scores || {}).map(Number);
            const stars = Number(field.maxStars) || 5;
            return Math.max(scores.length ? Math.max(...scores) : 0, stars * 2);
        }
        case 'nps': {
            const scores = Object.values(field.nps_scores || {}).map(Number);
            const maxNum = Number(field.nps_max) || 10;
            return Math.max(scores.length ? Math.max(...scores) : 0, maxNum * 10);
        }
        case 'yesno':
            return Math.max(field.yes_score || 10, field.no_score || 0) || 1;
        case 'segmented':
        case 'radio':
        case 'dropdown':
            return Math.max(
                0,
                ...(field.options || []).map((o) => (typeof o === 'object' ? Number(o.score) || 0 : 0))
            ) || 1;
        case 'checkbox':
            // every option can be checked at once
            return (
                (field.options || []).reduce(
                    (sum, o) => sum + (typeof o === 'object' ? Number(o.score) || 0 : 0),
                    0
                ) || 1
            );
        case 'slider':
            return 1; // rawFieldValue returns a 0..1 fraction for sliders
        default:
            return 0;
    }
};

export const calculateScore = (form, responses) => {
    if (!form?.form_content?.hasScoring) return null;
    const fields = (form.form_content.fields || []).filter((f) => f.type !== 'button');
    const totalScore = Number(form.form_content.total_score) || 100;

    let total = 0;
    let weightTotal = 0;
    fields.forEach((field) => {
        const weight = Number(field.max_score);
        const maxRaw = maxRawFieldValue(field);
        if (maxRaw <= 0) return; // non-scorable field
        weightTotal += weight > 0 ? weight : maxRaw;
        const val = responses?.[field.id];
        if (val === undefined || val === null) return;
        const fraction = Math.max(0, Math.min(1, rawFieldValue(field, val) / maxRaw));
        // weighted fields earn at most their weight; unweighted legacy fields
        // fall back to raw points.
        total += weight > 0 ? fraction * weight : rawFieldValue(field, val);
    });

    // Safety net for legacy forms whose weights don't add up to total_score:
    // scale onto the configured total so the display is always x / total_score.
    const scaled = weightTotal > 0 ? (total / weightTotal) * totalScore : total;
    return Math.round(Math.min(scaled, totalScore) * 10) / 10;
};

export default calculateScore;
