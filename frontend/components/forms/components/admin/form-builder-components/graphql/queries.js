import { gql } from '@apollo/client';

export const GET_EVALUATION_FORMS = gql`
    query GetEvaluationForms {
        getEvaluationForms {
            id
            form_id
            title
            form_content
            createdAt
        }
    }
`;

export const GET_EVALUATION_FORM = gql`
    query GetEvaluationForm($id: ID!) {
        getEvaluationForm(id: $id) {
            id
            form_id
            title
            form_content
            createdAt
        }
    }
`;

export const GET_EVALUATION_RESPONSES = gql`
    query GetEvaluationResponses($call_id: String) {
        getEvaluationResponses(call_id: $call_id) {
            id
            form_id
            call_id
            responses
            score
            createdAt
            updatedAt
        }
    }
`;

export const GET_EVALUATION_RESPONSE = gql`
    query GetEvaluationResponse($id: ID!) {
        getEvaluationResponse(id: $id) {
            id
            form_id
            call_id
            responses
            score
            createdAt
            updatedAt
        }
    }
`;

export const TRANSLATE_TEXTS = gql`
    query TranslateTexts($texts: [String!]!, $target: String!, $source: String) {
        translateTexts(texts: $texts, target: $target, source: $source)
    }
`;
