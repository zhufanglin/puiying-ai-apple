interface FormSectionProps {
  title: string;
  subtitle?: string;
  error?: string;
  children: React.ReactNode;
}

export default function FormSection({ title, subtitle, error, children }: FormSectionProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="mb-4 pb-3 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
