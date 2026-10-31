import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';

/**
 * Registers the service worker (TL-43, E-124) and offers a new version instead of reloading
 * on its own, so nobody loses what they are typing.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 text-[13px] shadow-[var(--shadow-float)]"
    >
      <span>{t('shell.newVersion')}</span>
      <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
        {t('shell.reload')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        {t('shell.later')}
      </Button>
    </div>
  );
}
