from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client.core import REGISTRY, GaugeMetricFamily
import psutil

from routers import auth, users, roles, system, messages, transactions
from routers import admin_db
from routers import family_assignation as family_assignation_router
from database import get_db_connection
from dependencies import ensure_revoked_tokens_table
from utils import init_users_graph


@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_revoked_tokens_table(cursor)
        try:
            conn.commit()
        except Exception:
            logging.exception(
                "[lifespan] Commit failed after ensuring revoked_tokens table"
            )
        # Initialize users graph at startup
        try:
            init_users_graph(app)
        except Exception:
            logging.exception("[lifespan] Failed to initialize users graph")
        yield
    finally:
        try:
            cursor.close()
        finally:
            try:
                conn.close()
            except Exception:
                logging.exception("[lifespan] Failed to close DB connection")


app = FastAPI(lifespan=lifespan)

# Basic logging configuration
logging.basicConfig(level=logging.INFO)

# CORS: Allow all origins (update for prod security later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(users.router, tags=["Users"])
app.include_router(roles.router, tags=["Roles"])
app.include_router(system.router, tags=["System"])
app.include_router(messages.router, tags=["Messages"])
app.include_router(transactions.router, tags=["Transactions"])
app.include_router(family_assignation_router.router, tags=["FamilyAssignations"])
app.include_router(admin_db.router, tags=["AdminDB"])

# Expose Prometheus metrics at /metrics
# Standard HTTP endpoint is appropriate for Prometheus scraping and frontend fetches
Instrumentator().instrument(app).expose(
    app, endpoint="/metrics", include_in_schema=False
)


# Register custom network I/O metrics using psutil
class _NetworkCollector:
    def collect(self):
        try:
            pernic = psutil.net_io_counters(pernic=True)
        except Exception:
            logging.exception("[metrics] Failed to read net_io_counters")
            pernic = {}
        bytes_family = GaugeMetricFamily(
            "system_network_bytes",
            "Network I/O bytes (absolute counters)",
            labels=["interface", "direction"],
        )
        packets_family = GaugeMetricFamily(
            "system_network_packets",
            "Network packets (absolute counters)",
            labels=["interface", "direction"],
        )
        for iface, stat in pernic.items():
            bytes_family.add_metric([iface, "recv"], float(stat.bytes_recv))
            bytes_family.add_metric([iface, "sent"], float(stat.bytes_sent))
            packets_family.add_metric([iface, "recv"], float(stat.packets_recv))
            packets_family.add_metric([iface, "sent"], float(stat.packets_sent))
        yield bytes_family
        yield packets_family


try:
    REGISTRY.register(_NetworkCollector())
except ValueError:
    # Already registered
    pass
