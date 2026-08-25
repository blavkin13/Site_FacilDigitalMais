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