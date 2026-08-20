// ==========================================
// CONFIGURAÇÃO PM2 PARA HOSTINGER VPS
// ==========================================

module.exports = {
  apps: [
    {
      name: "facil-digital-plus",
      script: "npm",
      args: "run start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
      },
      // Logs
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      // Rotação de logs
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};