"use client";

import dynamic from "next/dynamic";

// Public form-fill page for a single form. The form id comes from the URL via
// next/navigation's useParams inside FormRendererPage.
const FormRendererApp = dynamic(() => import("@/components/forms/FormRendererApp"), {
  ssr: false,
  loading: () => null,
});

export default function FormFillPage() {
  return <FormRendererApp />;
}
