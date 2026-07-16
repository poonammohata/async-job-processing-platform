import { bootstrap, handleBootstrapFailure } from './worker/worker.bootstrap';

bootstrap().catch(handleBootstrapFailure);
