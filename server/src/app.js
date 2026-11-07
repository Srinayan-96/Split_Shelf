const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { env } = require('./config/env');
const { globalLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Behind Render/Railway/nginx, every request appears to come from the proxy's IP.
// Without this, the rate limiter would treat ALL users as one person.
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL }));
app.use(express.json({ limit: '10kb' })); // our payloads are tiny; reject big ones

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', globalLimiter);
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/households', require('./routes/household.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/jobs', require('./routes/job.routes'));

app.use(notFound);
app.use(errorHandler); // must be last

module.exports = app;