import { IPrismComponents } from '@stoplight/prism-core';
import { IHttpOperation } from '@stoplight/types';
import fetch from 'node-fetch';
import { pipe } from 'fp-ts/lib/pipeable';
import * as E from 'fp-ts/lib/Either';
import * as TE from 'fp-ts/lib/TaskEither';
import * as RTE from 'fp-ts/lib/ReaderTaskEither';
import { defaults, omit } from 'lodash';
import { format, parse } from 'url';
import { posix } from 'path';
import { Logger } from 'pino';
import { IHttpConfig, IHttpRequest, IHttpResponse } from '../types';
import { parseResponse } from '../utils/parseResponse';
import { hopByHopHeaders } from './resources';

const { version: prismVersion } = require('../../package.json');

const forward: IPrismComponents<IHttpOperation, IHttpRequest, IHttpResponse, IHttpConfig>['forward'] = (
  input: IHttpRequest,
  baseUrl: string
): RTE.ReaderTaskEither<Logger, Error, IHttpResponse> => logger =>
  pipe(
    TE.tryCatch(async () => {
      const partialUrl = parse(baseUrl);
      const url = format({
        ...partialUrl,
        pathname: posix.join(partialUrl.pathname || '', input.url.path),
        query: input.url.query,
      });

      logger.info(`Forwarding "${input.method}" request to ${url}...`);

      return fetch(url, {
        body: input.rawBody,
        method: input.method,
        headers: defaults(omit(input.headers, ['host']), {
          accept: 'application/json, text/plain, */*',
          'user-agent': `Prism/${prismVersion}`,
        }),
      });
    }, E.toError),
    TE.chain(parseResponse),
    TE.map(stripHopByHopHeaders)
  );

export default forward;

const stripHopByHopHeaders = (response: IHttpResponse): IHttpResponse => {
  response.headers = omit(response.headers, hopByHopHeaders);
  return response;
};
