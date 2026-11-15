import 'reflect-metadata';
import { DataSource } from 'typeorm';

// Used by the TypeORM CLI (`npm run migration:*`). Loads env via dotenv-cli:
//   dotenv -e environments/.env.dev -- npm run migration:run
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/**/*.entit{y,ies}.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
});
