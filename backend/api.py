from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import logging

from routers import auth, users, roles, system

app = FastAPI()

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

# AWS Lambda Handler
handler = Mangum(app)
