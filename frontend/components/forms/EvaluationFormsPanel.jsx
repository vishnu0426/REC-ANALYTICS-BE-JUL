"use client";

import React, { useMemo, useState } from 'react';
import { ApolloProvider, useMutation, useQuery } from '@apollo/client/react';
import { Button, ConfigProvider, Popconfirm, Select, Spin, theme as antdTheme } from 'antd';
import { CheckCircle2, ClipboardList, Pencil, Trash2 } from 'lucide-react';
import { apolloClient } from './config.js';
import { ToastProvider, useToast } from './context/ToastContext.jsx';
import {
    GET_EVALUATION_FORMS,
    GET_EVALUATION_RESPONSES,
} from './components/admin/form-builder-components/graphql/queries.js';
import {
    SAVE_EVALUATION_RESPONSE,
    UPDATE_EVALUATION_RESPONSE,
    DELETE_EVALUATION_RESPONSE,
} from './components/admin/form-builder-components/graphql/mutations.js';
import FormRenderer from './components/common/FormRenderer.jsx';
import { calculateScore, getMissingRequiredFields } from './utils/score-utils.js';
import { localizeFields, isRTL } from './utils/i18n.js';
import { languageOptions } from './components/admin/form-builder-components/constants/languages.js';
import { GlobalOutlined } from '@ant-design/icons';
import './FormBuilder.css';

// Decide antd's dark/light algorithm for the themed form area so labels stay
// readable on the form's own background color.
const isDarkBackground = (hex) => {
    if (!hex || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return false;
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
};

function scoreHex(score) {
    if (score >= 85) return '#12805A';
    if (score >= 65) return '#9C6510';
    return '#C1352E';
}

/**
 * "Evaluation Forms" sub-tab of the call QA Scorecard: pick any form built in
 * the Forms module from the dropdown, fill it against this recording, and
 * submit — the evaluation is saved with this call's id attached
 * (saveEvaluationResponse(call_id: ...)), and past submissions for the call
 * are listed underneath.
 */
function EvaluationFormsPanel({ callId }) {
    const { showToast } = useToast();
    const [selectedFormId, setSelectedFormId] = useState(null);
    const [responses, setResponses] = useState({});
    const [lastSubmitted, setLastSubmitted] = useState(null);
    // Past submission being viewed/edited (null = composing a new evaluation).
    const [editing, setEditing] = useState(null);
    // Viewing language (defaults to the form's default language).
    const [lang, setLang] = useState(null);

    const { data: formsData, loading: loadingForms } = useQuery(GET_EVALUATION_FORMS);
    const { data: historyData, refetch: refetchHistory } = useQuery(GET_EVALUATION_RESPONSES, {
        variables: { call_id: callId },
        skip: !callId,
    });
    const [saveResponse, { loading: saving }] = useMutation(SAVE_EVALUATION_RESPONSE);
    const [updateResponse, { loading: updating }] = useMutation(UPDATE_EVALUATION_RESPONSE);
    const [deleteResponse, { loading: deleting }] = useMutation(DELETE_EVALUATION_RESPONSE);

    const forms = formsData?.getEvaluationForms ?? [];
    const history = historyData?.getEvaluationResponses ?? [];

    const selectedForm = useMemo(
        () => forms.find((f) => f.form_id === selectedFormId) ?? null,
        [forms, selectedFormId]
    );

    // form_content crosses the wire as a JSON string (same as the Forms module).
    const parsedForm = useMemo(() => {
        if (!selectedForm) return null;
        try {
            return { ...selectedForm, form_content: JSON.parse(selectedForm.form_content) };
        } catch {
            return null;
        }
    }, [selectedForm]);

    const score = parsedForm ? calculateScore(parsedForm, responses) : null;

    const handleSelect = (formId) => {
        setSelectedFormId(formId);
        setResponses({});
        setLastSubmitted(null);
        setEditing(null);
        // Open in the newly selected form's default language
        try {
            const f = forms.find((x) => x.form_id === formId);
            const content = f ? JSON.parse(f.form_content) : null;
            setLang(content?.default_language || 'en');
        } catch {
            setLang('en');
        }
    };

    const handleChange = (fieldId, value) => {
        setResponses((prev) => ({ ...prev, [fieldId]: value }));
    };

    /**
     * View/revise a past submission: reload its answers into the form (or a
     * brand-new one if the original form has since been deleted) so it can be
     * edited and saved back with updateEvaluationResponse.
     */
    const handleLoadSubmission = (row) => {
        const target = forms.find((f) => f.form_id === row.form_id);
        if (!target) {
            showToast('The form used for this evaluation no longer exists', 'error');
            return;
        }
        let parsed = {};
        try {
            parsed = row.responses ? JSON.parse(row.responses) : {};
        } catch {
            parsed = {};
        }
        setSelectedFormId(row.form_id);
        setResponses(parsed);
        setLastSubmitted(null);
        // Show the loaded evaluation in its form's default language
        try {
            const content = JSON.parse(target.form_content);
            setLang(content?.default_language || 'en');
        } catch {
            setLang('en');
        }
        setEditing({
            id: row.id,
            form_id: row.form_id,
            score: row.score,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        });
        showToast('Loaded past evaluation for editing', 'info');
    };

    const handleNewEvaluation = () => {
        setEditing(null);
        setResponses({});
        setLastSubmitted(null);
        showToast('Started a new evaluation', 'info');
    };

    const handleDelete = async (row) => {
        try {
            await deleteResponse({ variables: { id: row.id } });
            if (editing?.id === row.id) {
                setEditing(null);
                setResponses({});
                setLastSubmitted(null);
            }
            showToast('Evaluation deleted', 'success');
            refetchHistory();
        } catch {
            showToast('Failed to delete the evaluation', 'error');
        }
    };

    const handleSubmit = async () => {
        if (!parsedForm) return;
        const defaultLang = formContent?.default_language || 'en';
        const missing = getMissingRequiredFields(
            localizeFields(formContent?.fields, lang || defaultLang, defaultLang),
            responses
        );
        if (missing.length > 0) {
            showToast(`Fill the required fields: ${missing.join(', ')}`, 'error');
            return;
        }
        try {
            if (editing) {
                const result = await updateResponse({
                    variables: {
                        id: editing.id,
                        form_id: parsedForm.form_id,
                        call_id: callId,
                        responses: JSON.stringify(responses),
                        tags: JSON.stringify([]),
                        score,
                    },
                });
                const savedScore = result?.data?.updateEvaluationResponse?.score ?? score;
                setLastSubmitted({ score: savedScore, at: new Date(), updated: true });
                showToast(
                    savedScore != null ? `Evaluation updated · score ${savedScore}` : 'Evaluation updated',
                    'success'
                );
            } else {
                const result = await saveResponse({
                    variables: {
                        form_id: parsedForm.form_id,
                        call_id: callId,
                        responses: JSON.stringify(responses),
                        tags: JSON.stringify([]),
                        score,
                    },
                });
                const savedScore = result?.data?.saveEvaluationResponse?.score ?? score;
                setLastSubmitted({ score: savedScore, at: new Date() });
                setResponses({});
                showToast(
                    savedScore != null ? `Evaluation submitted · score ${savedScore}` : 'Evaluation submitted',
                    'success'
                );
            }
            refetchHistory();
        } catch {
            showToast(
                editing ? 'Failed to update the evaluation' : 'Failed to save the evaluation',
                'error'
            );
        }
    };

    const formContent = parsedForm?.form_content;
    const theme = formContent?.theme || {};
    const dark = isDarkBackground(theme.backgroundColor);
    const languages = formContent?.languages?.length ? formContent.languages : ['en'];
    const defaultLang = formContent?.default_language || 'en';
    const activeLang = lang || defaultLang;
    const localizedFields = localizeFields(formContent?.fields, activeLang, defaultLang);
    const rtl = isRTL(activeLang);

    return (
        <div className="space-y-5">
            {/* Form picker */}
            <div className="flex flex-wrap items-center gap-3">
                <label className="text-[10.5px] uppercase tracking-wide text-faint font-medium">
                    Evaluation form
                </label>
                {loadingForms ? (
                    <Spin size="small" />
                ) : forms.length === 0 ? (
                    <span className="text-[12.5px] text-muted">
                        No evaluation forms yet — create one under <span className="text-ink font-medium">Forms</span> in the sidebar.
                    </span>
                ) : (
                    <Select
                        style={{ minWidth: 300 }}
                        placeholder="Select a form to evaluate this call"
                        value={selectedFormId}
                        onChange={handleSelect}
                        options={forms.map((f) => ({ label: f.title, value: f.form_id }))}
                        popupMatchSelectWidth={false}
                    />
                )}
                {parsedForm && languages.length > 1 && (
                    <Select
                        value={activeLang}
                        onChange={setLang}
                        options={languageOptions(languages)}
                        style={{ minWidth: 180 }}
                        suffixIcon={<GlobalOutlined />}
                        optionFilterProp="label"
                        showSearch
                        size="small"
                        className="ml-auto"
                    />
                )}
                {formContent?.hasScoring && score != null && (
                    <div className="flex items-baseline gap-2 ml-auto">
                        <span className="font-mono text-[26px] font-semibold tabular" style={{ color: scoreHex(score) }}>
                            {score}
                        </span>
                        <span className="text-muted text-[12px]">
                            / {formContent.total_score || 0} form score
                        </span>
                    </div>
                )}
            </div>

            {/* Selected form, rendered on its own theme background (same as the
                standalone fill page) with matching antd light/dark tokens. */}
            {parsedForm && formContent && (
                <div
                    style={{
                        background: theme.backgroundImage
                            ? `url(${theme.backgroundImage})`
                            : theme.backgroundColor || '#f5f5f5',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        padding: 24,
                        borderRadius: 10,
                    }}
                >
                    <ConfigProvider
                        theme={
                            dark
                                ? { algorithm: antdTheme.darkAlgorithm }
                                : undefined
                        }
                    >
                        <div style={{ maxWidth: 760, margin: '0 auto' }} dir={rtl ? 'rtl' : 'ltr'}>
                            {editing && (
                                <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-md border border-[#2F6FED]/40 bg-[#2F6FED]/10">
                                    <span className="text-[12.5px] text-ink">
                                        Editing the evaluation from{' '}
                                        {editing.createdAt ? new Date(editing.createdAt).toLocaleString() : 'this call'}
                                    </span>
                                    <Button size="small" onClick={handleNewEvaluation}>
                                        Cancel & start new
                                    </Button>
                                </div>
                            )}
                            <h3
                                className="font-display text-[18px] font-semibold mb-1"
                                style={{ color: dark ? '#fff' : undefined }}
                            >
                                {parsedForm.title}
                            </h3>
                            <p className="text-[12.5px] mb-5" style={{ color: dark ? 'rgba(255,255,255,0.65)' : undefined }}>
                                Evaluate this recording with the form below. Fields marked with * are mandatory.
                            </p>
                            <FormRenderer
                                fields={localizedFields || []}
                                responses={responses}
                                onChange={handleChange}
                                formTheme={theme}
                                onSubmit={handleSubmit}
                                onReset={() => { setResponses({}); showToast('Form cleared', 'info'); }}
                            />
                            <div className="flex items-center gap-3 mt-6">
                                <Button
                                    type="primary"
                                    size="large"
                                    loading={saving || updating}
                                    onClick={handleSubmit}
                                >
                                    {editing ? 'Update evaluation' : 'Submit evaluation'}
                                </Button>
                                {editing && (
                                    <Button size="large" onClick={handleNewEvaluation}>
                                        New evaluation
                                    </Button>
                                )}
                                {lastSubmitted && (
                                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#12805A]">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        {lastSubmitted.updated ? 'Updated' : 'Saved'}
                                        {lastSubmitted.score != null ? ` · score ${lastSubmitted.score}` : ''} at{' '}
                                        {lastSubmitted.at.toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </ConfigProvider>
                </div>
            )}

            {!parsedForm && !loadingForms && forms.length > 0 && (
                <div className="border border-dashed border-hairline rounded-lg px-5 py-8 flex flex-col items-center text-center gap-2">
                    <ClipboardList className="w-5 h-5 text-faint" />
                    <div className="text-[13px] text-ink font-medium">Select a form to start</div>
                    <p className="text-[12.5px] text-muted max-w-md">
                        Choose an evaluation form above, answer it against this recording, and submit — the
                        result is stored with the call and listed below.
                    </p>
                </div>
            )}

            {/* Past submissions for this call: click a row to view/revise it,
                or delete it. Multiple evaluations per recording are allowed. */}
            {history.length > 0 && (
                <div>
                    <h4 className="text-[11px] uppercase tracking-wide text-faint font-semibold mb-2.5">
                        Submitted evaluations for this call ({history.length})
                    </h4>
                    <div className="space-y-1.5">
                        {history.map((row) => {
                            const title = forms.find((f) => f.form_id === row.form_id)?.title ?? row.form_id;
                            const isEditing = editing?.id === row.id;
                            return (
                                <div
                                    key={row.id}
                                    className={`border rounded-md px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                        isEditing
                                            ? 'border-[#2F6FED] bg-[#2F6FED]/5'
                                            : 'border-hairline hover:bg-panelRaised'
                                    }`}
                                    onClick={() => handleLoadSubmission(row)}
                                    title="Click to view / edit this evaluation"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Pencil className="w-3.5 h-3.5 text-faint shrink-0" />
                                        <div className="text-[13px] font-medium truncate">{title}</div>
                                        {isEditing && (
                                            <span className="text-[10.5px] uppercase tracking-wide text-[#2F6FED] font-semibold shrink-0">
                                                Editing
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        className="flex items-center gap-3 shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {row.score != null && (
                                            <span
                                                className="font-mono text-[14px] tabular font-medium"
                                                style={{ color: scoreHex(row.score) }}
                                            >
                                                {row.score}
                                            </span>
                                        )}
                                        <span className="text-[11.5px] text-faint">
                                            {row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}
                                        </span>
                                        <Button
                                            size="small"
                                            type="text"
                                            onClick={() => handleLoadSubmission(row)}
                                        >
                                            View / Edit
                                        </Button>
                                        <Popconfirm
                                            title="Delete this evaluation?"
                                            description="The submitted evaluation will be removed permanently."
                                            okText="Delete"
                                            cancelText="Cancel"
                                            okButtonProps={{ danger: true }}
                                            onConfirm={() => handleDelete(row)}
                                        >
                                            <Button
                                                size="small"
                                                type="text"
                                                danger
                                                loading={deleting}
                                                aria-label="Delete evaluation"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </Popconfirm>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Self-contained wrapper: the call page has no Apollo/toast context (those
 * live in the Forms routes), so the panel brings its own providers.
 */
export default function EvaluationFormsPanelWithProviders({ callId }) {
    return (
        <ApolloProvider client={apolloClient}>
            <ToastProvider>
                <EvaluationFormsPanel callId={callId} />
            </ToastProvider>
        </ApolloProvider>
    );
}
