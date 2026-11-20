from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="comp_core_api")
app.include_router(health.router)
