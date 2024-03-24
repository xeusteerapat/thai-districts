import fastify from 'fastify';
import { chromium } from 'playwright';
import fastifyRedis from '@fastify/redis';

const server = fastify({
  logger: true,
});

server.register(fastifyRedis, {
  host: 'cache', // basically the name of the service in the docker-compose file
  password: process.env.REDIS_PASSWORD,
  port: 6379, // Redis port
  family: 4,
});

server.get('/', async (req, reply) => {
  return {
    hello: 'world',
  };
});

server.get('/api/districts', async (req, reply) => {
  try {
    const t0 = performance.now();
    const { redis } = server;
    const cachedData = await redis.get('districts');

    if (cachedData) {
      // t2 - t1 = time to retrieve data from cache
      const tCached = performance.now();
      return reply.code(200).send({
        timeUsing: `${tCached - t0} milliseconds`,
        message: 'Data retrieved from cache',
        data: JSON.parse(cachedData),
      });
    }

    // Launch a browser instance
    const browser = await chromium.launch();
    // Create a new page
    const page = await browser.newPage();

    // Navigate to the Wikipedia page
    await page.goto(
      'https://en.wikipedia.org/wiki/List_of_districts_of_Thailand'
    );

    // Find the table element
    const tableElement = await page.$$(
      '.wikitable.sortable.jquery-tablesorter'
    );

    // Extract table data as JSON
    const tableData = await Promise.all(
      tableElement.map(async (table) => {
        const rows = await table.$$eval('tr', (rows) =>
          rows
            .slice(1)
            .map((row) =>
              [...row.querySelectorAll('td')].map((cell) =>
                cell.textContent!.trim()
              )
            )
        );
        return rows;
      })
    );

    const flatData = tableData.flat();

    const result = flatData.map((arr) => {
      const [englishName, thaiName, englishProvince, thaiProvince, region] =
        arr;

      return {
        englishName,
        thaiName,
        englishProvince,
        thaiProvince,
        region,
      };
    });

    await browser.close();
    const t1 = performance.now();
    console.log(`Call to doSomething took ${t1 - t0} milliseconds.`);

    await redis.set('districts', JSON.stringify(result), 'EX', 60 * 60 * 24);

    return reply.code(200).send({
      timeUsing: `${t1 - t0} milliseconds`,
      total: result.length,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error scraping district data:', error.message);
      throw new Error('Internal server error');
    }
  }
});

const start = async () => {
  try {
    await server.listen({ port: 3002, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
