from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserSchema(BaseModel):
    id: int
    firstname: str
    lastname: str
    role: str
    image_url: Optional[str] = None
    birthday: Optional[str] = None
    id_father: Optional[int] = None
    id_mother: Optional[int] = None
    # Pour la démo, on envoie directement les noms des parents s'ils existent
    father_name: Optional[str] = None
    mother_name: Optional[str] = None

@app.get("/tree", response_model=List[UserSchema])
async def get_tree():
    # Données simulées enrichies
    users_db = [
        {
            "id": 1, "firstname": "Jean", "lastname": "Dupont", "role": "Grand-Père",
            "birthday": "12/05/1940", "image_url": "https://i.pravatar.cc/150?u=1",
            "id_father": None, "id_mother": None
        },
        {
            "id": 2, "firstname": "Marc", "lastname": "Dupont", "role": "Père",
            "birthday": "23/08/1975", "image_url": None, # Pas d'image -> Initiales MD
            "id_father": 1, "father_name": "Jean Dupont",
            "id_mother": None
        },
        {
            "id": 3, "firstname": "Lucie", "lastname": "Martin", "role": "Mère",
            "birthday": "14/02/1978", "image_url": "https://i.pravatar.cc/150?u=3",
            "id_father": None, "id_mother": None
        },
        {
            "id": 4, "firstname": "Lucas", "lastname": "Dupont", "role": "Fils",
            "birthday": "10/11/2005", "image_url": "https://i.pravatar.cc/150?u=4",
            "id_father": 2, "father_name": "Marc Dupont",
            "id_mother": 3, "mother_name": "Lucie Martin"
        },
        {
            "id": 5, "firstname": "Emma", "lastname": "Dupont", "role": "Fille",
            "birthday": "05/06/2008", "image_url": None, # Pas d'image -> Initiales ED
            "id_father": 2, "father_name": "Marc Dupont",
            "id_mother": None
        }
    ]
    return users_db