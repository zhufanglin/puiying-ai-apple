"""用户 / 角色 / 权限 模型"""
from typing import Optional

from sqlalchemy import BigInteger, ForeignKey, String, Table, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

# ============== 角色表 ==============

class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(50), unique=True, comment="角色名")
    display_name: Mapped[str] = mapped_column(String(50), comment="显示名称")
    description: Mapped[Optional[str]] = mapped_column(String(200), comment="描述")

    users: Mapped[list["User"]] = relationship(back_populates="role")


# ============== 用户表 ==============

class User(Base, TimestampMixin):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, comment="登录名")
    password_hash: Mapped[str] = mapped_column(String(200), comment="bcrypt 哈希")
    display_name: Mapped[str] = mapped_column(String(50), comment="显示姓名")
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), comment="角色ID")
    phone: Mapped[Optional[str]] = mapped_column(String(20), comment="手机号")
    email: Mapped[Optional[str]] = mapped_column(String(100), comment="邮箱")
    is_active: Mapped[bool] = mapped_column(default=True, comment="是否启用")

    role: Mapped["Role"] = relationship(back_populates="users")
    permissions: Mapped[list["RolePermission"]] = relationship(secondary="role_permissions", viewonly=True)


# ============== 权限表 ==============

class Permission(Base, TimestampMixin):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(100), unique=True, index=True, comment="权限码: apple:awards:read")
    name: Mapped[str] = mapped_column(String(100), comment="权限名称")
    module: Mapped[str] = mapped_column(String(50), comment="归属模块: apple / accounts / admin")


# ============== 角色-权限 关联表 ==============

class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), primary_key=True)
    permission_id: Mapped[int] = mapped_column(ForeignKey("permissions.id"), primary_key=True)
