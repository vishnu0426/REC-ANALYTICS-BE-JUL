import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

// Ported from the Vite project: VITE_API_URL -> NEXT_PUBLIC_API_BASE_URL.
// The Python backend serves GraphQL at <base>/graphql (default: /api/v1/graphql
// on the FastAPI server at http://localhost:8000).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

const httpLink = createHttpLink({
  uri: `${API_BASE_URL}/graphql`,
  // No cookie-based auth exists on this backend, and CORS runs with a wildcard
  // origin, so credentialed requests would be rejected by the browser.
  credentials: 'omit',
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

export { API_BASE_URL };
