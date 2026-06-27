# Railway SQL Server Service

The STARLIMS agent needs a SQL Server service reachable from the Railway backend.
Railway's managed `railway add --database` options do not include SQL Server, so
run SQL Server as a Docker image service and attach a persistent volume.

## Service Setup

After `railway login` and `railway link`:

```sh
railway add --service starlims-sql --image mcr.microsoft.com/mssql/server:2022-latest \
  --variables ACCEPT_EULA=Y \
  --variables MSSQL_PID=Developer \
  --variables MSSQL_SA_PASSWORD=<strong-password>

railway service link starlims-sql
railway volume add --mount-path /var/opt/mssql
```

Set these variables on the backend Railway service:

```sh
STARLIMS_SQL_HOST=<starlims-sql private domain>
STARLIMS_SQL_PORT=1433
STARLIMS_SQL_DATABASE=STARLIMS_DATA
STARLIMS_SQL_USER=<read-only app login>
STARLIMS_SQL_PASSWORD=<read-only app password>
STARLIMS_SQL_TIMEOUT_SECONDS=20
```

Use the Railway private/internal domain for `STARLIMS_SQL_HOST`. Create a
read-only login for the backend after restoring or importing the STARLIMS test
database; do not use `sa` from the app service.

The backend Railway service should use `backend/` as its root directory so
`backend/railway.json` and `backend/Procfile` apply.
