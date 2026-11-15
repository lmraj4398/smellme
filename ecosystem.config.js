// pm2 process file. Start with:  pm2 start ecosystem.config.js   (from the repo root, after `npm run build`)
// Settings come from environments/.env.production (Node loads it with --env-file; it is never committed).
module.exports = {
  apps: [
    {
      name: 'smellme',
      script: 'dist/main.js',
      cwd: __dirname,
      node_args: '--env-file=environments/.env.production',
      instances: 1, // one process: the rate limiter and OTP/session state are in memory
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      env: { NODE_ENV: 'production' },
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
