import type { ReactNode } from "react";
import "./students.css";

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return <div className="a4-students">{children}</div>;
}
