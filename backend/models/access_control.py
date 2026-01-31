from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from models.database import Base


class Roles(Base):
    __tablename__ = 'roles'

    id = Column(Integer, primary_key=True, autoincrement=True)
    role = Column(String(45), nullable=False)

    role_attributions = relationship("RoleAttribution", back_populates="role_obj")


class RoleAttribution(Base):
    __tablename__ = 'role_attribution'

    id = Column(Integer, primary_key=True, autoincrement=True)
    users_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    roles_id = Column(Integer, ForeignKey("roles.id"), nullable=False)

    role_obj = relationship("Roles", back_populates="role_attributions")