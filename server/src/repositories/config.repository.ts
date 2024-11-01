import { Injectable } from '@nestjs/common';
import { join, resolve } from 'node:path';
import { citiesFile, excludePaths } from 'src/constants';
import { Telemetry } from 'src/decorators';
import { ImmichEnvironment, ImmichTelemetry, ImmichWorker, LogLevel } from 'src/enum';
import { EnvData, IConfigRepository } from 'src/interfaces/config.interface';
import { DatabaseExtension } from 'src/interfaces/database.interface';
import { QueueName } from 'src/interfaces/job.interface';
import { setDifference } from 'src/utils/set';

// TODO replace src/config validation with class-validator, here

const productionKeys = {
  client:
    'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUF2LzdTMzJjUkE1KysxTm5WRHNDTQpzcFAvakpISU1xT0pYRm5oNE53QTJPcHorUk1mZGNvOTJQc09naCt3d1FlRXYxVTJjMnBqelRpUS8ybHJLcS9rCnpKUmxYd2M0Y1Vlc1FETUpPRitQMnFPTlBiQUprWHZDWFlCVUxpdENJa29Md2ZoU0dOanlJS2FSRGhkL3ROeU4KOCtoTlJabllUMWhTSWo5U0NrS3hVQ096YXRQVjRtQ0RlclMrYkUrZ0VVZVdwOTlWOWF6dkYwRkltblRXcFFTdwpjOHdFWmdPTWg0c3ZoNmFpY3dkemtQQ3dFTGFrMFZhQkgzMUJFVUNRTGI5K0FJdEhBVXRKQ0t4aGI1V2pzMXM5CmJyWGZpMHZycGdjWi82RGFuWTJxZlNQem5PbXZEMkZycmxTMXE0SkpOM1ZvN1d3LzBZeS95TWNtelRXWmhHdWgKVVFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tDQo=',
  server:
    'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUFvcG5ZRGEwYS9kVTVJZUc3NGlFRQpNd2RBS2pzTmN6TGRDcVJkMVo5eTVUMndqTzdlWUlPZUpUc2wzNTBzUjBwNEtmU1VEU1h2QzlOcERwYzF0T0tsCjVzaEMvQXhwdlFBTENva0Y0anQ4dnJyZDlmQ2FYYzFUcVJiT21uaGl1Z0Q2dmtyME8vRmIzVURpM1UwVHZoUFAKbFBkdlNhd3pMcldaUExmbUhWVnJiclNLbW45SWVTZ3kwN3VrV1RJeUxzY2lOcnZuQnl3c0phUmVEdW9OV1BCSApVL21vMm1YYThtNHdNV2hpWGVoaUlPUXFNdVNVZ1BlQ3NXajhVVngxQ0dsUnpQREEwYlZOUXZlS1hXVnhjRUk2ClVMRWdKeTJGNDlsSDArYVlDbUJmN05FcjZWUTJXQjk1ZXZUS1hLdm4wcUlNN25nRmxjVUF3NmZ1VjFjTkNUSlMKNndJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tDQo=',
};

const stagingKeys = {
  client:
    'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUFuSUNyTm5jbGpPSC9JdTNtWVVaRQp0dGJLV1c3OGRuajl5M0U2ekk3dU1NUndEckdYWFhkTGhkUDFxSWtlZHh0clVVeUpCMWR4R04yQW91S082MlNGCldrbU9PTmNGQlRBWFZTdjhUNVY0S0VwWnFQYWEwaXpNaGxMaE5sRXEvY1ZKdllrWlh1Z2x6b1o3cG1nbzFSdHgKam1iRm5NNzhrYTFRUUJqOVdLaEw2eWpWRUl2MDdVS0lKWHBNTnNuS2g1V083MjZhYmMzSE9udTlETjY5VnFFRQo3dGZrUnRWNmx2U1NzMkFVMngzT255cHA4ek53b0lPTWRibGsyb09aWWROZzY0Y3l2SzJoU0FlU3NVMFRyOVc5Ckgra0Y5QlNCNlk0QXl0QlVkSmkrK2pMSW5HM2Q5cU9ieFVzTlYrN05mRkF5NjJkL0xNR0xSOC9OUFc0U0s3c0MKRlFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tDQo=',
  server:
    'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUE3Sy8yd3ZLUS9NdU8ydi9MUm5saAoyUy9zTHhDOGJiTEw1UUlKOGowQ3BVZW40YURlY2dYMUpKUmtGNlpUVUtpNTdTbEhtS3RSM2JOTzJmdTBUUVg5Ck5WMEJzVzllZVB0MmlTMWl4VVFmTzRObjdvTjZzbEtac01qd29RNGtGRGFmM3VHTlZJc0dMb3UxVWRLUVhpeDEKUlRHcXVTb3NZVjNWRlk3Q1hGYTVWaENBL3poVXNsNGFuVXp3eEF6M01jUFVlTXBaenYvbVZiQlRKVzBPSytWZgpWQUJvMXdYMkVBanpBekVHVzQ3Vko4czhnMnQrNHNPaHFBNStMQjBKVzlORUg5QUpweGZzWE4zSzVtM00yNUJVClZXcTlRYStIdHRENnJ0bnAvcUFweXVkWUdwZk9HYTRCUlZTR1MxMURZM0xrb2FlRzYwUEU5NHpoYjduOHpMWkgKelFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tDQo=',
};

const WORKER_TYPES = new Set(Object.values(ImmichWorker));
const TELEMETRY_TYPES = new Set(Object.values(ImmichTelemetry));

const asSet = <T>(value: string | undefined, defaults: T[]) => {
  const values = (value || '').replaceAll(/\s/g, '').split(',').filter(Boolean);
  return new Set(values.length === 0 ? defaults : (values as T[]));
};

const getEnv = (): EnvData => {
  const includedWorkers = asSet(process.env.IMMICH_WORKERS_INCLUDE, [ImmichWorker.API, ImmichWorker.MICROSERVICES]);
  const excludedWorkers = asSet(process.env.IMMICH_WORKERS_EXCLUDE, []);
  const workers = [...setDifference(includedWorkers, excludedWorkers)];
  for (const worker of workers) {
    if (!WORKER_TYPES.has(worker)) {
      throw new Error(`Invalid worker(s) found: ${workers.join(',')}`);
    }
  }

  const environment = process.env.IMMICH_ENV as ImmichEnvironment;
  const isProd = environment === ImmichEnvironment.PRODUCTION;
  const buildFolder = process.env.IMMICH_BUILD_DATA || '/build';
  const folders = {
    // eslint-disable-next-line unicorn/prefer-module
    dist: resolve(`${__dirname}/..`),
    geodata: join(buildFolder, 'geodata'),
    web: join(buildFolder, 'www'),
  };

  const databaseUrl = process.env.DB_URL;

  let redisConfig = {
    host: process.env.REDIS_HOSTNAME || 'redis',
    port: Number.parseInt(process.env.REDIS_PORT || '') || 6379,
    db: Number.parseInt(process.env.REDIS_DBINDEX || '') || 0,
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    path: process.env.REDIS_SOCKET || undefined,
  };

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && redisUrl.startsWith('ioredis://')) {
    try {
      redisConfig = JSON.parse(Buffer.from(redisUrl.slice(10), 'base64').toString());
    } catch (error) {
      throw new Error(`Failed to decode redis options: ${error}`);
    }
  }

  const includedTelemetries =
    process.env.IMMICH_TELEMETRY_INCLUDE === 'all'
      ? new Set(Object.values(ImmichTelemetry))
      : asSet<ImmichTelemetry>(process.env.IMMICH_TELEMETRY_INCLUDE, []);

  const excludedTelemetries = asSet<ImmichTelemetry>(process.env.IMMICH_TELEMETRY_EXCLUDE, []);
  const telemetries = setDifference(includedTelemetries, excludedTelemetries);
  for (const telemetry of telemetries) {
    if (!TELEMETRY_TYPES.has(telemetry)) {
      throw new Error(`Invalid telemetry found: ${telemetry}`);
    }
  }

  return {
    host: process.env.IMMICH_HOST,
    port: Number(process.env.IMMICH_PORT) || 2283,
    environment,
    configFile: process.env.IMMICH_CONFIG_FILE,
    logLevel: process.env.IMMICH_LOG_LEVEL as LogLevel,

    buildMetadata: {
      build: process.env.IMMICH_BUILD,
      buildUrl: process.env.IMMICH_BUILD_URL,
      buildImage: process.env.IMMICH_BUILD_IMAGE,
      buildImageUrl: process.env.IMMICH_BUILD_IMAGE_URL,
      repository: process.env.IMMICH_REPOSITORY,
      repositoryUrl: process.env.IMMICH_REPOSITORY_URL,
      sourceRef: process.env.IMMICH_SOURCE_REF,
      sourceCommit: process.env.IMMICH_SOURCE_COMMIT,
      sourceUrl: process.env.IMMICH_SOURCE_URL,
      thirdPartySourceUrl: process.env.IMMICH_THIRD_PARTY_SOURCE_URL,
      thirdPartyBugFeatureUrl: process.env.IMMICH_THIRD_PARTY_BUG_FEATURE_URL,
      thirdPartyDocumentationUrl: process.env.IMMICH_THIRD_PARTY_DOCUMENTATION_URL,
      thirdPartySupportUrl: process.env.IMMICH_THIRD_PARTY_SUPPORT_URL,
    },

    bull: {
      config: {
        prefix: 'immich_bull',
        connection: { ...redisConfig },
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
      queues: Object.values(QueueName).map((name) => ({ name })),
    },

    database: {
      config: {
        type: 'postgres',
        entities: [`${folders.dist}/entities` + '/*.entity.{js,ts}'],
        migrations: [`${folders.dist}/migrations` + '/*.{js,ts}'],
        subscribers: [`${folders.dist}/subscribers` + '/*.{js,ts}'],
        migrationsRun: false,
        synchronize: false,
        connectTimeoutMS: 10_000, // 10 seconds
        parseInt8: true,
        ...(databaseUrl
          ? { connectionType: 'url', url: databaseUrl }
          : {
              connectionType: 'parts',
              host: process.env.DB_HOSTNAME || 'database',
              port: Number(process.env.DB_PORT) || 5432,
              username: process.env.DB_USERNAME || 'postgres',
              password: process.env.DB_PASSWORD || 'postgres',
              database: process.env.DB_DATABASE_NAME || 'immich',
            }),
      },

      skipMigrations: process.env.DB_SKIP_MIGRATIONS === 'true',
      vectorExtension:
        process.env.DB_VECTOR_EXTENSION === 'pgvector' ? DatabaseExtension.VECTOR : DatabaseExtension.VECTORS,
    },

    licensePublicKey: isProd ? productionKeys : stagingKeys,

    network: {
      trustedProxies: (process.env.IMMICH_TRUSTED_PROXIES ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    },

    otel: {
      metrics: {
        hostMetrics: telemetries.has(ImmichTelemetry.HOST),
        apiMetrics: {
          enable: telemetries.has(ImmichTelemetry.API),
          ignoreRoutes: excludePaths,
        },
      },
    },

    redis: redisConfig,

    resourcePaths: {
      lockFile: join(buildFolder, 'build-lock.json'),
      geodata: {
        dateFile: join(folders.geodata, 'geodata-date.txt'),
        admin1: join(folders.geodata, 'admin1CodesASCII.txt'),
        admin2: join(folders.geodata, 'admin2Codes.txt'),
        cities500: join(folders.geodata, citiesFile),
        naturalEarthCountriesPath: join(folders.geodata, 'ne_10m_admin_0_countries.geojson'),
      },
      web: {
        root: folders.web,
        indexHtml: join(folders.web, 'index.html'),
      },
    },

    storage: {
      ignoreMountCheckErrors: process.env.IMMICH_IGNORE_MOUNT_CHECK_ERRORS === 'true',
    },

    telemetry: {
      apiPort: Number(process.env.IMMICH_API_METRICS_PORT || '') || 8081,
      microservicesPort: Number(process.env.IMMICH_MICROSERVICES_METRICS_PORT || '') || 8082,
      metrics: telemetries,
    },

    workers,

    noColor: !!process.env.NO_COLOR,
  };
};

let cached: EnvData | undefined;

@Injectable()
@Telemetry({ enabled: false })
export class ConfigRepository implements IConfigRepository {
  getEnv(): EnvData {
    if (!cached) {
      cached = getEnv();
    }

    return cached;
  }
}

export const clearEnvCache = () => (cached = undefined);
