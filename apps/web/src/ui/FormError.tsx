import { WarningCircle } from '@phosphor-icons/react';

export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--danger-soft)] px-3 py-2 text-[var(--danger)]"
    >
      <WarningCircle size={18} className="mt-px shrink-0" aria-hidden />
      {message}
    </p>
  );
}
