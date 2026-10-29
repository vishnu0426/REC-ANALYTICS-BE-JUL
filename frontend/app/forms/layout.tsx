import type { ReactNode } from "react";
import "@/components/forms/FormBuilder.css";

export const metadata = {
  title: "Forms · AgnoCall",
  description: "Build, preview and share evaluation forms.",
};

export default function FormsLayout({ children }: { children: ReactNode }) {
  // FormBuilder.css is the form-builder studio's global stylesheet, imported
  // here (app-router layouts may import global CSS) so it only loads on
  // /forms routes.
  return <div className="min-h-screen">{children}</div>;
}
