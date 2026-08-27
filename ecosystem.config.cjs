module.exports = {
  apps: [
    {
      name:
        "facil-digital-mais",

      cwd:
        __dirname,

      script:
        "./node_modules/next/dist/bin/next",

      args:
        "start -H 127.0.0.1 -p 3000",

      /**
       * Configuração de produção carregada
       * diretamente pelo Node.js.
       *
       * O repositório guarda somente o CAMINHO do
       * arquivo protegido.
       *
       * Credenciais, tokens e secrets permanecem em:
       *
       * /etc/facil-digital-plus/production.env
       *
       * O arquivo deve existir no servidor com
       * permissões restritas antes do PM2 iniciar
       * a aplicação.
       */
      node_args:
        "--env-file=/etc/facil-digital-plus/production.env",

      /**
       * SQLite será utilizado inicialmente com
       * uma única instância da aplicação.
       *
       * O Nginx pode atender muitas conexões,
       * enquanto este processo mantém um único
       * contexto de escrita SQLite.
       */
      instances:
        1,

      exec_mode:
        "fork",

      autorestart:
        true,

      watch:
        false,

      max_memory_restart:
        "1G",

      kill_timeout:
        10000,

      listen_timeout:
        10000,

      restart_delay:
        2000,

      env: {
        NODE_ENV:
          "production",

        PORT:
          "3000",
      },
    },
  ],
};