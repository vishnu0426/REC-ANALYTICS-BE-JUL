"use client";

import dynamic from "next/dynamic";

// The builder is antd + browser-only (localStorage theme, canvas, drag & drop),
// so it mounts client-side only.
const FormBuilderApp = dynamic(() => import("@/components/forms/FormBuilderApp"), {
  ssr: false,
  loading: () => null,
});

export default function FormsPage() {
  return <FormBuilderApp />;
}
