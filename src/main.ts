import { ValidationPipe, VersioningType } from '@nestjs/common';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import compression from 'compression';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { AllConfigType, AppConfig } from './config/config.types';
import { logger } from './logger';
import { validationOptions } from './utils/validation-options';
import { GlobalExceptionFilter } from './common/filters/api-error.filter';
import { TrimPipe } from './common/pipes/trim.pipe';
import { setupSocketAdapter } from './modules/chat/adapters/redis.adapter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { S3UrlRewriteInterceptor } from './common/interceptors/s3-url-rewrite.interceptor';
import { Reflector } from '@nestjs/core';

function filterSwaggerByPanel(doc: OpenAPIObject, adminPanel: boolean): OpenAPIObject {
  const filteredPaths = {} as OpenAPIObject['paths'];
  for (const [path, value] of Object.entries(doc.paths ?? {})) {
    const isAdmin = path.includes('/admin/');
    if (adminPanel ? isAdmin : !isAdmin) {
      filteredPaths![path] = value;
    }
  }
  return { ...doc, paths: filteredPaths };
}

function buildSwaggerNavJs(projectName: string, activePanel: 'admin' | 'user'): string {
  const adminUrl = '/docs/admin';
  const userUrl = '/docs/user';
  const isAdmin = activePanel === 'admin';

  return `
(function () {
  function injectNav() {
    const topbar = document.querySelector('.topbar-wrapper');
    if (!topbar || document.getElementById('_panelNav')) return;

    // Brand link
    const link = topbar.querySelector('.link');
    if (link) {
      link.innerHTML = '<span style="font-size:16px;font-weight:700;">${projectName}</span>';
      link.href = '${userUrl}';
      link.style.textDecoration = 'none';
    }

    // Nav container
    const nav = document.createElement('div');
    nav.id = '_panelNav';
    nav.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:8px;';

    const makeBtn = (href, label, active) => {
      const a = document.createElement('a');
      a.href = href;
      a.innerText = label;
      a.title = 'Switch to ' + label;
      a.style.cssText = [
        'display:inline-flex;align-items:center;padding:6px 16px;',
        'border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;',
        'transition:all .15s ease;border:2px solid #fff;',
        active
          ? 'background:#fff;color:#1b4fd8;box-shadow:0 2px 6px rgba(0,0,0,.25);'
          : 'background:transparent;color:#fff;opacity:.85;',
      ].join('');
      if (!active) {
        a.addEventListener('mouseenter', () => { a.style.opacity = '1'; a.style.background = 'rgba(255,255,255,.15)'; });
        a.addEventListener('mouseleave', () => { a.style.opacity = '.85'; a.style.background = 'transparent'; });
      }
      return a;
    };

    nav.appendChild(makeBtn('${adminUrl}', '🛡 Admin Panel', ${String(isAdmin)}));
    nav.appendChild(makeBtn('${userUrl}',  '👤 User Panel',  ${String(!isAdmin)}));
    topbar.appendChild(nav);
  }

  // Try immediately, then poll in case Swagger renders late
  injectNav();
  const t = setInterval(() => { injectNav(); if (document.getElementById('_panelNav')) clearInterval(t); }, 200);
})()
  `;
}

async function bootstrap() {
  console.info('\x1b[32m%s\x1b[0m', '🔧 Node Version:', process.version);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    rawBody: true,
    bufferLogs: true,
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });
  app.enableShutdownHooks();

  app.useBodyParser('json', { limit: '1mb' });

  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const configService = app.get(ConfigService<AllConfigType>);
  const config = configService.get<AppConfig>('app', {
    infer: true,
  }) as AppConfig;
  console.log('🚀 ~ bootstrap ~ config:', config);

  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://*.s3.amazonaws.com',
            configService.getOrThrow('s3.awsDomainUrl', { infer: true }),
          ],
          mediaSrc: ["'self'", 'blob:', 'data:'],
          connectSrc: ["'self'", 'wss:', 'https:'],
          upgradeInsecureRequests: [],
        },
      },
    }),
  );

  app.use(
    compression({
      level: 1,
      filter: (req, res) => {
        return (
          compression.filter(req, res) &&
          (req.headers['accept-encoding']?.includes('gzip') || false)
        );
      },
    }),
  );

  app.setGlobalPrefix(config.apiPrefix, {
    exclude: ['/', 'health', 'ws', 'socket.io'],
  });

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalPipes(new TrimPipe(), new ValidationPipe(validationOptions));
  app.useGlobalFilters(new GlobalExceptionFilter());

  // S3 URL rewrite interceptor (prepends CDN domain to relative S3 keys in responses)
  const s3UrlRewriteInterceptor = app.get(S3UrlRewriteInterceptor);
  app.useGlobalInterceptors(s3UrlRewriteInterceptor, new ResponseInterceptor(new Reflector()));

  const swaggerContact = {
    name: 'Suresh Ojha',
    url: 'https://gitlab.webskitters.com/node/consultly.git',
    email: 'suresh.webskitters@gmail.com',
  };

  const baseOptions = new DocumentBuilder()
    .setTitle(`${config.project} API`)
    .setDescription(`API documentation for ${config.project}`)
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication')
    .addTag('Admin', 'Administrative Actions')
    .addTag('Roles', 'RBAC Role Management')
    .addTag('Users', 'User Management')
    .setContact(swaggerContact.name, swaggerContact.url, swaggerContact.email)
    .build();

  const fullDocument = SwaggerModule.createDocument(app, baseOptions);

  const adminDocument = filterSwaggerByPanel(fullDocument, true);
  const userDocument = filterSwaggerByPanel(fullDocument, false);

  const sharedSwaggerOpts = {
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  };

  SwaggerModule.setup('docs/admin', app, adminDocument, {
    ...sharedSwaggerOpts,
    customSiteTitle: `${config.project} Admin API Docs`,
    customJsStr: buildSwaggerNavJs(config.project, 'admin'),
  });

  SwaggerModule.setup('docs/user', app, userDocument, {
    ...sharedSwaggerOpts,
    customSiteTitle: `${config.project} User API Docs`,
    customJsStr: buildSwaggerNavJs(config.project, 'user'),
  });

  app.useStaticAssets(join(__dirname, '..', 'public'));

  logger.info(`➜ Starting ${config.name} service ...`, {
    context: 'Bootstrap::api',
  });

  await setupSocketAdapter(app, configService);

  await app.listen(config.port, () => {
    const url = `http://${config.host}:${config.port}`;
    const apiUrl = `${url}/${config.apiPrefix}`;
    const adminDocsUrl = `${url}/docs/admin`;
    const userDocsUrl = `${url}/docs/user`;
    const healthUrl = `${url}/health`;
    const bullBoardUrl = `${url}/api/queues`;
    const chatWsUrl = `${url}/chat`;

    logger.info(
      `
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🚀 Server is running!                                        ║
║                                                                ║
║   ➤ Environment: ${config.env.padEnd(43)}║
║   ➤ URL: ${url.padEnd(51)}║
║   ➤ API: ${apiUrl.padEnd(51)}║
║   ➤ Admin Docs: ${adminDocsUrl.padEnd(44)}║
║   ➤ User Docs: ${userDocsUrl.padEnd(45)}║
║   ➤ BullBoard: ${bullBoardUrl.padEnd(45)}║
║   ➤ Health: ${healthUrl.padEnd(48)}║
║   ➤ Chat WS: ${chatWsUrl.padEnd(47)}║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `,
      {
        context: 'Bootstrap::api',
      },
    );
  });
}
bootstrap().catch(console.error);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});
