from sqlalchemy import Column, Integer, String, Date, SmallInteger, ForeignKey
from sqlalchemy.orm import relationship
from models.database import Base


class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    firstname = Column(String(45), nullable=False)
    lastname = Column(String(45), nullable=False)
    username = Column(String(45), nullable=False)
    email = Column(String(45), nullable=True)
    telephone = Column(String(45), nullable=True)
    password = Column(String(100), nullable=False)
    birthday = Column(Date, nullable=True)
    isactive = Column(SmallInteger, nullable=False, default=0)
    isfirstlogin = Column(SmallInteger, nullable=False, default=1)

    # Relations pour la table d'assignation
    # Un utilisateur peut être assigné (sous la responsabilité de quelqu'un)
    assignments = relationship(
        "FamilyAssignation",
        foreign_keys="FamilyAssignation.users_assigned_id",
        back_populates="assigned_user",
    )
    # Un utilisateur peut être responsable de plusieurs personnes
    managed_members = relationship(
        "FamilyAssignation",
        foreign_keys="FamilyAssignation.users_responsable_id",
        back_populates="responsible_user",
    )


class FamilyAssignation(Base):
    __tablename__ = "family_assignation"

    id = Column(Integer, primary_key=True, autoincrement=True)
    users_assigned_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    users_responsable_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    assigned_user = relationship(
        "Users", foreign_keys=[users_assigned_id], back_populates="assignments"
    )
    responsible_user = relationship(
        "Users", foreign_keys=[users_responsable_id], back_populates="managed_members"
    )
