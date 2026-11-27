from fastapi import FastAPI

from app.routers import dashboard, health, items, stock_movements

app = FastAPI(title="comp_core_api")
app.include_router(health.router)
app.include_router(items.router)
app.include_router(dashboard.router)
app.include_router(stock_movements.router)
