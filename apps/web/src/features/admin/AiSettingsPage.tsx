import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

const aiQuery = {
  queryKey: ['admin', 'ai'],
  queryFn: () => unwrap(client.GET('/api/v1/admin/ai')),
};

/** The language model for semantic search and the AI action (TL-49, E-139). */
export function AiSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useQuery(aiQuery);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [chatModel, setChatModel] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [dailyLimit, setDailyLimit] = useState('200');
  const [queryPrefix, setQueryPrefix] = useState('');
  const [documentPrefix, setDocumentPrefix] = useState('');
  useEffect(() => {
    if (!settings.data) return;
    setBaseUrl(settings.data.baseUrl);
    setChatModel(settings.data.chatModel);
    setEmbeddingModel(settings.data.embeddingModel);
    setDailyLimit(String(settings.data.dailyLimit));
    setQueryPrefix(settings.data.queryPrefix);
    setDocumentPrefix(settings.data.documentPrefix);
  }, [settings.data]);
  const save = useMutation({
    mutationFn: (removeKey: boolean) =>
      unwrap(
        client.PUT('/api/v1/admin/ai', {
          body: {
            baseUrl: baseUrl.trim(),
            ...(removeKey ? { apiKey: '' } : apiKey ? { apiKey } : {}),
            chatModel,
            embeddingModel,
            queryPrefix,
            documentPrefix,
            dailyLimit: Number(dailyLimit) || 0,
          },
        }),
      ),
    onSuccess: (saved) => {
      setApiKey('');
      queryClient.setQueryData(aiQuery.queryKey, saved);
      void queryClient.invalidateQueries({ queryKey: ['search', 'semantic-status'] });
    },
  });
  const test = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/admin/ai/test')),
  });
  const data = settings.data;
  return (
    <main className="flex max-w-[720px] flex-col gap-4">
      <h1 className="m-0 text-[24px] leading-[30px] font-extrabold tracking-[-0.025em]">
        {t('ai.title')}
      </h1>
      <p className="m-0 text-[var(--ink-muted)]">{t('ai.intro')}</p>
      {(settings.error ?? save.error ?? test.error) && (
        <FormError message={(settings.error ?? save.error ?? test.error)?.message ?? ''} />
      )}
      {data && !data.vectorAvailable && (
        <p role="note" className="m-0 text-[13px] text-[var(--ink-muted)]">
          {t('ai.noVector')}
        </p>
      )}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(false);
        }}
      >
        <TextField
          label={t('ai.baseUrl')}
          help={t('ai.baseUrlHelp')}
          value={baseUrl}
          placeholder="http://ollama:11434/v1"
          onChange={(event) => setBaseUrl(event.target.value)}
        />
        <TextField
          label={t('ai.apiKey')}
          help={data?.hasApiKey ? t('ai.apiKeySet') : t('ai.apiKeyHelp')}
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <TextField
          label={t('ai.embeddingModel')}
          help={t('ai.embeddingModelHelp')}
          value={embeddingModel}
          placeholder="nomic-embed-text"
          onChange={(event) => setEmbeddingModel(event.target.value)}
        />
        <TextField
          label={t('ai.queryPrefix')}
          help={t('ai.queryPrefixHelp')}
          value={queryPrefix}
          onChange={(event) => setQueryPrefix(event.target.value)}
        />
        <TextField
          label={t('ai.documentPrefix')}
          help={t('ai.documentPrefixHelp')}
          value={documentPrefix}
          onChange={(event) => setDocumentPrefix(event.target.value)}
        />
        <TextField
          label={t('ai.chatModel')}
          help={t('ai.chatModelHelp')}
          value={chatModel}
          placeholder="llama3.1"
          onChange={(event) => setChatModel(event.target.value)}
        />
        <TextField
          label={t('ai.dailyLimit')}
          help={data ? t('ai.usedToday', { count: data.usedToday }) : undefined}
          type="number"
          min={0}
          value={dailyLimit}
          onChange={(event) => setDailyLimit(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t('common.save')}
          </Button>
          <Button
            type="button"
            disabled={test.isPending || !data?.baseUrl}
            onClick={() => test.mutate()}
          >
            {t('ai.test')}
          </Button>
          {data?.hasApiKey && (
            <Button type="button" disabled={save.isPending} onClick={() => save.mutate(true)}>
              {t('ai.removeKey')}
            </Button>
          )}
          {save.isSuccess && (
            <span role="status" className="text-[13px] text-[var(--ink-muted)]">
              {t('signIn.saved')}
            </span>
          )}
        </div>
      </form>
      {test.data && (
        <ul className="m-0 flex flex-col gap-1 pl-5 text-[13px]">
          {(['chat', 'embeddings'] as const).map((kind) => (
            <li
              key={kind}
              className={test.data[kind].ok ? 'text-[var(--success)]' : 'text-[var(--danger)]'}
            >
              {t(kind === 'chat' ? 'ai.chatModel' : 'ai.embeddingModel')}: {test.data[kind].detail}
            </li>
          ))}
        </ul>
      )}
      {data?.vectorAvailable && data.embeddingModel && (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">
          {t('ai.indexed', { issues: data.indexed.issues, pages: data.indexed.pages })}
        </p>
      )}
    </main>
  );
}
