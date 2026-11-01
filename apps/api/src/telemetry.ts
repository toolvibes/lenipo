import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * OpenTelemetry traces (P-OPS-04, TL-42, E-123), only when an OTLP endpoint is configured with
 * the standard variables. Imported before everything else, so HTTP and Express are patched
 * before Nest loads them. PostgreSQL queries (postgres.js) have no instrumentation yet.
 */
const endpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

export const telemetry = endpoint
  ? new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'lenipo',
      instrumentations: [
        new HttpInstrumentation({
          // Probes and scrapes would drown the interesting traces.
          ignoreIncomingRequestHook: (request) => /\/health\/|\/metrics/.test(request.url ?? ''),
        }),
        new ExpressInstrumentation(),
      ],
    })
  : null;

telemetry?.start();
