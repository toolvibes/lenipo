import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-dist';

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lenipo API</title>
  <link rel="stylesheet" href="/api/docs/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api/docs/swagger-ui-bundle.js"></script>
  <script src="/api/docs/init.js"></script>
</body>
</html>`;

// validatorUrl null: Swagger UI would otherwise send the document to an external validator.
const INIT = `window.ui = SwaggerUIBundle({
  url: '/api/v1/openapi.json',
  dom_id: '#swagger-ui',
  validatorUrl: null,
  withCredentials: true,
  persistAuthorization: false,
});`;

/** Interactive API documentation at /api/docs, served locally (decision E-28). */
export function serveApiDocs(app: NestExpressApplication): void {
  app.use('/api/docs', (request: Request, response: Response, next: () => void) => {
    if (request.path === '/' || request.path === '') {
      response.type('html').send(PAGE);
    } else if (request.path === '/init.js') {
      response.type('application/javascript').send(INIT);
    } else {
      next();
    }
  });
  app.useStaticAssets(swaggerUi.getAbsoluteFSPath(), { prefix: '/api/docs/', index: false });
}
