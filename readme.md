# URL Shortener API

A URL shortener API built with **Node.js, Express, PostgreSQL, Prisma ORM, Redis, and Docker**. It allows users to submit long URLs, generate unique short codes, and redirect visitors to their original destinations.

The project also uses Redis to cache URL lookups, reducing repeated database queries when a shortened URL is accessed.

## Features

- **URL shortening:** Generate a unique code for a submitted URL.
- **Duplicate detection:** Check whether a URL already exists before creating a new record.
- **URL redirection:** Redirect visitors from a short code to its original URL.
- **Persistent storage:** Store URL records in PostgreSQL.
- **Caching:** Use Redis to cache URL lookup results.
- **Input validation:** Validate submitted URLs before processing them.
- **Containerized development:** Run the application, database, and Redis using Docker Compose.

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | HTTP server and routing |
| PostgreSQL | Persistent database |
| Prisma ORM | Database queries and schema management |
| Redis | Cache for URL lookups |
| Docker | Containerization |
| Docker Compose | Local multi-service development |
| Zod | Request validation |

## Architecture

The application uses PostgreSQL as its primary data store and Redis as a caching layer.

```text
Client
  |
  | POST / or GET /:code
  v
Express.js API
  |
  +---- POST /
  |       |
  |       v
  |    Validate URL
  |       |
  |       v
  |    PostgreSQL
  |       |
  |       v
  |    Generate/store short code
  |
  +---- GET /:code
          |
          v
       Check Redis cache
          |
          +---- Cache hit ----> Redirect
          |
          +---- Cache miss
                    |
                    v
                PostgreSQL
                    |
                    v
                Cache result
                    |
                    v
                 Redirect
```

## Getting Started

### Prerequisites

Install the following tools:

- [Node.js](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine with Docker Compose
- [Git](https://git-scm.com/)
- An API client such as [Postman](https://www.postman.com/) or `curl`

You can optionally install [TablePlus](https://tableplus.com/) to inspect your PostgreSQL database through a graphical interface.

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd url-shortner
```

Replace `<YOUR_REPOSITORY_URL>` with the actual Git repository URL.

### 2. Configure environment variables

Create a `.env` file in the project root.

For running the application and its dependencies through Docker Compose, the configuration should follow this pattern:

```env
PORT=3000
DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@db:5432/<DB_NAME>
REDIS_URL=redis://redis:6379
```

Replace the database placeholders with the credentials and database name configured in your Docker Compose file.

**Important:** When the application runs inside Docker Compose, use the database service name (`db`) and Redis service name (`redis`) as hostnames.

If you run the Node.js application directly on your computer instead, use `localhost` for services whose ports are published to your host.

Never commit real passwords, production credentials, or secret environment files to Git.

### 3. Start the services

From the project root, run:

```bash
docker compose up --build
```

This should build and start the services defined in your Compose configuration:

- `app` — the Express API
- `db` — PostgreSQL
- `redis` — Redis

The API is configured to listen on port `3000`.

If the application starts successfully, visit:

```text
http://localhost:3000
```

The root endpoint is used for creating shortened URLs. A browser request to the root may return a response indicating that the route or HTTP method is not supported, depending on the routes implemented.

To stop the services, run:

```bash
docker compose down
```

To stop the services and remove the Compose-managed database volume, **do not add `-v` unless you intend to delete the local database data**.

### 4. Install dependencies and generate Prisma Client

The project uses Prisma for database access. Its development script is configured as:

```json
{
  "dev": "prisma generate && nodemon index.js"
}
```

If you need to install dependencies manually, run:

```bash
npm install
```

Prisma Client generation is included in the development script. You can also run it directly:

```bash
npx prisma generate
```

If your Prisma schema has not yet been migrated to the database, apply the appropriate migration before using the API. For a development environment with Prisma migrations already configured, this is typically:

```bash
npx prisma migrate dev
```

Run Prisma commands in the environment where the correct `DATABASE_URL` is available. For Docker-based development, that usually means executing the command inside the application container or using the Compose configuration that provides the correct environment variables.

## API Reference

The API currently exposes two primary endpoints.

### 1. Create a shortened URL

**Endpoint:** `POST /`

Creates a short code for a URL that can be used for redirection. The API checks whether the submitted URL already exists before creating a new record.

Request headers:

```http
Content-Type: application/json
```

Request body:

```json
{
  "url": "https://www.linkedin.com/"
}
```

Example request using `curl`:

```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.linkedin.com/"}'
```

The API validates the request and checks the database for an existing URL.

- If the URL is new, a record is created with a unique code.
- If the URL already exists, the API can report that the record already exists.
- Invalid or missing URL values should be rejected by the validation middleware.

Use a complete URL containing `https://` or `http://`. For example, use `https://linkedin.com` rather than `linkedin.com`.

The exact response body and whether the endpoint returns the generated short URL depend on the current route implementation.

### 2. Redirect to the original URL

**Endpoint:** `GET /:code`

Looks up a stored URL using its short code and redirects the client to the original destination.

Example:

```bash
curl -i http://localhost:3000/<SHORT_CODE>
```

Replace `<SHORT_CODE>` with a code returned by your application or retrieved from the database.

The lookup flow is:

1. Receive the short code from the request parameters.
2. Check Redis for a cached URL record.
3. If the record is cached, parse the cached value and redirect.
4. If there is a cache miss, query PostgreSQL through Prisma.
5. Cache the database result and redirect to the original URL.
6. Return a `404 Not Found` response if the code does not exist.

The redirect target should be the original URL, not a relative path on `localhost`.

### Example workflow

1. Submit a URL to `POST /`.
2. Obtain the generated short code from the API response or database.
3. Open `http://localhost:3000/<SHORT_CODE>` in a browser.
4. The application looks up the record and redirects to the destination.

## Database

PostgreSQL stores the URL records.

The Prisma model is represented by the `Urls` table, with fields for the record ID, original URL, short code, and creation timestamp.

The fields used by the application include:

| Field | Purpose |
|---|---|
| `id` | Record identifier |
| `url` | Original destination URL |
| `code` | Unique short code used for redirects |
| `createdAt` | Record creation timestamp |

The precise types and constraints are defined by the project's Prisma schema.

To inspect records with SQL:

```sql
SELECT * FROM "Urls";
```

Run this query in a database client connected to the correct database and schema.

For a graphical database client, create a PostgreSQL connection using the host, port, username, password, and database name configured for your local environment.

## Redis Caching

Redis is used to cache URL records and avoid querying PostgreSQL on every redirect.

The intended lookup pattern is known as **cache-aside**:

1. Look for the requested code in Redis.
2. If it is present, return the cached result.
3. If it is absent, query PostgreSQL.
4. Store the result in Redis with an expiration time.
5. Redirect to the original URL.

The application uses a Redis connection URL configured through `REDIS_URL`.

In Docker Compose, the Redis hostname is `redis` because services can communicate using their Compose service names.

A cache expiration should be configured explicitly so cached entries eventually expire. The actual duration depends on the application's current implementation.

## Project Structure

The following is a guide to the main project files. Adjust the tree if your repository differs.

```text
url-shortner/
├── index.js
├── lib/
│   ├── prisma.js
│   └── redis.js
├── middleware/
│   └── validator.js
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
├── Dockerfile
├── package.json
├── package-lock.json
├── .env
└── .gitignore
```

- `index.js` — Express application and API routes.
- `lib/prisma.js` — Prisma database client setup.
- `lib/redis.js` — Redis client setup.
- `middleware/validator.js` — URL request validation.
- `prisma/schema.prisma` — Database model definitions.
- `docker-compose.yml` — Local application and infrastructure services.
- `Dockerfile` — Instructions for building the application image.
- `.env` — Local environment variables.

The `.env` file should remain local and should not be committed to version control.

## Deployment

The application can be deployed to a platform that supports Node.js applications or Docker containers.

The deployment platform must provide a reachable PostgreSQL database and Redis instance, either as managed services or separately hosted infrastructure.

### Deploying to Railway

Railway is one option for deploying the API and its dependencies.

#### 1. Push the project to Git

Ensure the project is committed to a Git repository hosted on GitHub or another supported Git provider.

Before pushing, verify that:

- `.env` is excluded from Git.
- The application starts correctly.
- Required dependencies are listed in `package.json`.
- The application listens on the configured `PORT`.
- Database access and Redis caching work locally.

#### 2. Create a Railway project

Visit [Railway](https://railway.com/) and create a project.

Connect your Git repository and configure a service for the URL shortener. Railway should build and deploy the application using the repository's configuration or Dockerfile.

#### 3. Provision PostgreSQL and Redis

Add PostgreSQL and a Redis-compatible service to the Railway project, or connect the application to externally hosted instances.

Each service must be reachable from the deployed application.

Do not assume the local Compose hostnames `db` and `redis` will work in production. Use the actual connection URLs or private service hostnames supplied by the deployment environment.

#### 4. Configure production environment variables

Set the required variables in the Railway service's environment configuration:

```env
DATABASE_URL=<PRODUCTION_POSTGRES_CONNECTION_URL>
DATABASE_NAME=<DATABASE_NAME>
DATABASE_PASSWORD=<DATABASE_PASSWORD>
REDIS_URL=<PRODUCTION_REDIS_CONNECTION_URL>
```

Use the real connection URLs provided by your services. Do not copy local database credentials into production.

Keep secrets out of your source code and public repository.

#### 5. Prepare the database

Apply the project's committed Prisma migrations against the production database.

For a production deployment, use:

```bash
npx prisma migrate deploy
```

Ensure the deployment process runs this command in an environment with the production `DATABASE_URL` available. It must not run against your local development database by accident.

The project should also generate Prisma Client during the build or deployment process.