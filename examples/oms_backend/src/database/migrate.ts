import { Umzug, SequelizeStorage } from 'umzug'
import { createOmsSequelize } from './database.config'

async function main() {
  const command = process.argv[2] || 'up'
  const sequelize = createOmsSequelize()

  const umzug = new Umzug({
    migrations: {
      glob: 'src/database/migrations/*.js',
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  })

  if (command === 'down') {
    await umzug.down()
  } else {
    await umzug.up()
  }

  await sequelize.close()
}

void main()
