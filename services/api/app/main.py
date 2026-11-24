from fastapi import FastAPI

from app.routers import attendance, health

app = FastAPI(title="comp_core_api")
app.include_router(health.router)
app.include_router(attendance.router)
