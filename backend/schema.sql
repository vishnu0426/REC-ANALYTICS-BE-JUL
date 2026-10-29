--
-- PostgreSQL database dump
--

\restrict mwEFnKgxUzaIShOafeRGwKyOl8yJoLepHos2JWTOqsLJJxCraHALopmPLR4aXuB

-- Dumped from database version 15.18
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: callstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.callstatus AS ENUM (
    'uploaded',
    'validating',
    'processing',
    'processed',
    'failed'
);


--
-- Name: jobstage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.jobstage AS ENUM (
    'audio',
    'diarization',
    'speech',
    'llm',
    'qa',
    'compliance',
    'analytics',
    'report'
);


--
-- Name: jobstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.jobstatus AS ENUM (
    'queued',
    'running',
    'succeeded',
    'failed',
    'retrying'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    id uuid NOT NULL,
    external_agent_id character varying,
    name character varying NOT NULL,
    team character varying,
    created_at timestamp without time zone
);


--
-- Name: ai_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_observations (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    observation_text text NOT NULL,
    timestamp_ref double precision,
    category character varying
);


--
-- Name: call_classifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_classifications (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    category character varying,
    subcategory character varying,
    complexity character varying,
    confidence double precision,
    created_at timestamp without time zone
);


--
-- Name: call_extractions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_extractions (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    customer_name character varying,
    customer_phone character varying,
    customer_email character varying,
    customer_account_id character varying,
    call_reason_primary character varying,
    call_reason_secondary character varying,
    resolution_summary text,
    follow_up_required boolean,
    follow_up_reason text,
    created_at timestamp without time zone
);


--
-- Name: call_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_insights (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    main_topic character varying,
    intent character varying,
    outcome character varying,
    root_cause text,
    executive_summary text,
    detailed_summary text,
    sub_topics json,
    keywords json,
    key_discussion_points json,
    action_items json,
    created_at timestamp without time zone
);


--
-- Name: call_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_labels (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    label character varying NOT NULL,
    confidence double precision,
    reason text
);


--
-- Name: calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calls (
    id uuid NOT NULL,
    agent_id uuid,
    original_filename character varying NOT NULL,
    storage_path character varying NOT NULL,
    status public.callstatus NOT NULL,
    failure_reason text,
    duration_seconds integer,
    language character varying,
    call_date timestamp without time zone,
    uploaded_at timestamp without time zone,
    processed_at timestamp without time zone,
    call_metadata json
);


--
-- Name: compliance_violations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_violations (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    rule_code character varying NOT NULL,
    category character varying NOT NULL,
    severity character varying NOT NULL,
    timestamp_ref double precision,
    explanation text,
    evidence text,
    reviewed boolean,
    review_outcome character varying
);


--
-- Name: conversation_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_analytics (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    duration_seconds integer,
    avg_silence_seconds double precision,
    longest_silence_seconds double precision,
    talk_ratio_agent double precision,
    talk_ratio_customer double precision,
    interruption_count integer,
    questions_asked integer,
    questions_answered integer,
    hold_count integer,
    hold_duration_seconds double precision,
    audio_quality_score double precision,
    health_score double precision
);


--
-- Name: customer_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_analytics (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    intent character varying,
    mood character varying,
    risk_level character varying,
    repeat_call_probability double precision,
    escalation_risk double precision,
    churn_risk double precision,
    csat_prediction double precision
);


--
-- Name: emotion_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emotion_analysis (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    dominant_customer_emotion character varying,
    dominant_agent_emotion character varying,
    timeline json
);


--
-- Name: manual_qa_criteria_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_qa_criteria_scores (
    id uuid NOT NULL,
    review_id uuid NOT NULL,
    criterion character varying NOT NULL,
    ai_score double precision,
    manual_score double precision,
    comment text
);


--
-- Name: manual_qa_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_qa_reviews (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    reviewer_name character varying NOT NULL,
    status character varying NOT NULL,
    overall_score double precision,
    notes text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: pause_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pause_events (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    start_time double precision NOT NULL,
    end_time double precision NOT NULL,
    duration_seconds double precision NOT NULL,
    severity character varying NOT NULL,
    preceding_speaker character varying,
    following_speaker character varying
);


--
-- Name: processing_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processing_jobs (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    stage public.jobstage NOT NULL,
    status public.jobstatus NOT NULL,
    attempt_count integer,
    error_message text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone
);


--
-- Name: qa_criteria_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qa_criteria_scores (
    id uuid NOT NULL,
    qa_evaluation_id uuid NOT NULL,
    criterion character varying NOT NULL,
    score double precision NOT NULL,
    explanation text,
    timestamp_ref double precision,
    transcript_evidence text,
    confidence double precision
);


--
-- Name: qa_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qa_evaluations (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    overall_score double precision NOT NULL,
    strengths text,
    weaknesses text,
    coaching_suggestions text,
    improvement_plan text,
    created_at timestamp without time zone
);


--
-- Name: recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendations (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    category character varying NOT NULL,
    text text NOT NULL,
    priority character varying
);


--
-- Name: sentiment_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sentiment_analysis (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    overall_sentiment character varying NOT NULL,
    beginning_sentiment character varying,
    middle_sentiment character varying,
    end_sentiment character varying,
    timeline json
);


--
-- Name: timeline_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timeline_events (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    event_type character varying NOT NULL,
    start_time double precision NOT NULL,
    end_time double precision,
    description text
);


--
-- Name: transcript_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transcript_segments (
    id uuid NOT NULL,
    transcript_id uuid NOT NULL,
    speaker_role character varying,
    sequence integer NOT NULL,
    start_time double precision NOT NULL,
    end_time double precision NOT NULL,
    text_masked text NOT NULL,
    text_unmasked text,
    stt_confidence double precision
);


--
-- Name: transcripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transcripts (
    id uuid NOT NULL,
    call_id uuid NOT NULL,
    pii_masked boolean,
    full_text_masked text,
    full_text_unmasked text,
    created_at timestamp without time zone
);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: ai_observations ai_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_observations
    ADD CONSTRAINT ai_observations_pkey PRIMARY KEY (id);


--
-- Name: call_classifications call_classifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_classifications
    ADD CONSTRAINT call_classifications_pkey PRIMARY KEY (id);


--
-- Name: call_extractions call_extractions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_extractions
    ADD CONSTRAINT call_extractions_pkey PRIMARY KEY (id);


--
-- Name: call_insights call_insights_call_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_insights
    ADD CONSTRAINT call_insights_call_id_key UNIQUE (call_id);


--
-- Name: call_insights call_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_insights
    ADD CONSTRAINT call_insights_pkey PRIMARY KEY (id);


--
-- Name: call_labels call_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_labels
    ADD CONSTRAINT call_labels_pkey PRIMARY KEY (id);


--
-- Name: calls calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);


--
-- Name: compliance_violations compliance_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_violations
    ADD CONSTRAINT compliance_violations_pkey PRIMARY KEY (id);


--
-- Name: conversation_analytics conversation_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_analytics
    ADD CONSTRAINT conversation_analytics_pkey PRIMARY KEY (id);


--
-- Name: customer_analytics customer_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_analytics
    ADD CONSTRAINT customer_analytics_pkey PRIMARY KEY (id);


--
-- Name: emotion_analysis emotion_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emotion_analysis
    ADD CONSTRAINT emotion_analysis_pkey PRIMARY KEY (id);


--
-- Name: manual_qa_criteria_scores manual_qa_criteria_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_qa_criteria_scores
    ADD CONSTRAINT manual_qa_criteria_scores_pkey PRIMARY KEY (id);


--
-- Name: manual_qa_reviews manual_qa_reviews_call_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_qa_reviews
    ADD CONSTRAINT manual_qa_reviews_call_id_key UNIQUE (call_id);


--
-- Name: manual_qa_reviews manual_qa_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_qa_reviews
    ADD CONSTRAINT manual_qa_reviews_pkey PRIMARY KEY (id);


--
-- Name: pause_events pause_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pause_events
    ADD CONSTRAINT pause_events_pkey PRIMARY KEY (id);


--
-- Name: processing_jobs processing_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_jobs
    ADD CONSTRAINT processing_jobs_pkey PRIMARY KEY (id);


--
-- Name: qa_criteria_scores qa_criteria_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_criteria_scores
    ADD CONSTRAINT qa_criteria_scores_pkey PRIMARY KEY (id);


--
-- Name: qa_evaluations qa_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_evaluations
    ADD CONSTRAINT qa_evaluations_pkey PRIMARY KEY (id);


--
-- Name: recommendations recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_pkey PRIMARY KEY (id);


--
-- Name: sentiment_analysis sentiment_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sentiment_analysis
    ADD CONSTRAINT sentiment_analysis_pkey PRIMARY KEY (id);


--
-- Name: timeline_events timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_pkey PRIMARY KEY (id);


--
-- Name: transcript_segments transcript_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcript_segments
    ADD CONSTRAINT transcript_segments_pkey PRIMARY KEY (id);


--
-- Name: transcripts transcripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcripts
    ADD CONSTRAINT transcripts_pkey PRIMARY KEY (id);


--
-- Name: ai_observations ai_observations_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_observations
    ADD CONSTRAINT ai_observations_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: call_classifications call_classifications_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_classifications
    ADD CONSTRAINT call_classifications_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: call_extractions call_extractions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_extractions
    ADD CONSTRAINT call_extractions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: call_insights call_insights_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_insights
    ADD CONSTRAINT call_insights_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: call_labels call_labels_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_labels
    ADD CONSTRAINT call_labels_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: calls calls_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: compliance_violations compliance_violations_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_violations
    ADD CONSTRAINT compliance_violations_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: conversation_analytics conversation_analytics_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_analytics
    ADD CONSTRAINT conversation_analytics_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: customer_analytics customer_analytics_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_analytics
    ADD CONSTRAINT customer_analytics_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: emotion_analysis emotion_analysis_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emotion_analysis
    ADD CONSTRAINT emotion_analysis_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: manual_qa_criteria_scores manual_qa_criteria_scores_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_qa_criteria_scores
    ADD CONSTRAINT manual_qa_criteria_scores_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.manual_qa_reviews(id);


--
-- Name: manual_qa_reviews manual_qa_reviews_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_qa_reviews
    ADD CONSTRAINT manual_qa_reviews_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: pause_events pause_events_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pause_events
    ADD CONSTRAINT pause_events_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: processing_jobs processing_jobs_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_jobs
    ADD CONSTRAINT processing_jobs_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: qa_criteria_scores qa_criteria_scores_qa_evaluation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_criteria_scores
    ADD CONSTRAINT qa_criteria_scores_qa_evaluation_id_fkey FOREIGN KEY (qa_evaluation_id) REFERENCES public.qa_evaluations(id);


--
-- Name: qa_evaluations qa_evaluations_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_evaluations
    ADD CONSTRAINT qa_evaluations_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: recommendations recommendations_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: sentiment_analysis sentiment_analysis_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sentiment_analysis
    ADD CONSTRAINT sentiment_analysis_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: timeline_events timeline_events_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: transcript_segments transcript_segments_transcript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcript_segments
    ADD CONSTRAINT transcript_segments_transcript_id_fkey FOREIGN KEY (transcript_id) REFERENCES public.transcripts(id);


--
-- Name: transcripts transcripts_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcripts
    ADD CONSTRAINT transcripts_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- PostgreSQL database dump complete
--

\unrestrict mwEFnKgxUzaIShOafeRGwKyOl8yJoLepHos2JWTOqsLJJxCraHALopmPLR4aXuB

