from sqlalchemy import Column, Integer, String, Date, Enum, SmallInteger, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from models_orm.database import Base


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
    createdat = Column(DateTime, nullable=False, default=func.now())
    updatedat = Column(DateTime, nullable=False, default=func.now())
    createdby = Column(Integer, ForeignKey("users.id"), nullable=True)
    updatedby = Column(Integer, ForeignKey("users.id"), nullable=True)
    id_father = Column(Integer, ForeignKey("users.id"), nullable=True)
    id_mother = Column(Integer, ForeignKey("users.id"), nullable=True)
    image_url = Column(String(255), nullable=True)
    gender = Column(String(45), nullable=True)
    contribution_tier = Column(
        Enum("LEVEL1", "LEVEL2", "LEVEL3", "LEVEL4", name="contribution_tier"),
        nullable=True,
    )
    
    assignments = relationship(
        "FamilyAssignation",
        foreign_keys="FamilyAssignation.users_assigned_id",
        back_populates="assigned_user",
    )
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
