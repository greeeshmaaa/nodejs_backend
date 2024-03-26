module.exports = {
    apps: [{
      name: 'EmpowerHerAPI',
      script: './src/app.js',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      }
    }]
  };
  