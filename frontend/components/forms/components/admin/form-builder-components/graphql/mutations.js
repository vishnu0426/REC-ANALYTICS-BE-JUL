import { gql } from '@apollo/client';

export const SAVE_EVALUATION_FORM = gql`
    mutation SaveEvaluationForm($form_id: String!, $title: String!, $form_content: String!) {
        saveEvaluationForm(form_id: $form_id, title: $title, form_content: $form_content) {
            id
            form_id
            title
            form_content
            createdAt
        }
    }
`;

export const DELETE_EVALUATION_FORM = gql`
    mutation DeleteEvaluationForm($id: ID!) {
        deleteEvaluationForm(id: $id)
    }
`;

export const SAVE_EVALUATION_RESPONSE = gql`
    mutation SaveEvaluationResponse($inum: String, $form_id: String!, $call_id: String, $responses: String, $tags: String, $user_id: ID, $score: Float) {
        saveEvaluationResponse(inum: $inum, form_id: $form_id, call_id: $call_id, responses: $responses, tags: $tags, user_id: $user_id, score: $score) {
            id
            form_id
            call_id
            score
        }
    }
`;

export const UPDATE_EVALUATION_RESPONSE = gql`
    mutation UpdateEvaluationResponse($id: ID!, $form_id: String, $call_id: String, $responses: String, $tags: String, $score: Float) {
        updateEvaluationResponse(id: $id, form_id: $form_id, call_id: $call_id, responses: $responses, tags: $tags, score: $score) {
            id
            form_id
            call_id
            score
            updatedAt
        }
    }
`;

export const DELETE_EVALUATION_RESPONSE = gql`
    mutation DeleteEvaluationResponse($id: ID!) {
        deleteEvaluationResponse(id: $id)
    }
`;
