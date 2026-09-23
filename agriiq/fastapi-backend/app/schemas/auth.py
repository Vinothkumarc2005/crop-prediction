"""
Auth Pydantic schemas — port of Java AuthDtos.java.

Field names and validation rules match the original DTOs exactly so the
frontend JSON contract remains unchanged.
"""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(alias="fullName", min_length=1)
    phone: str | None = None
    district: str | None = None
    state: str | None = None
    role: str = "FARMER"
    language: str = "en"

    model_config = {"populate_by_name": True}

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("FARMER", "AGRONOMIST"):
            raise ValueError("role must be FARMER or AGRONOMIST")
        return v

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        allowed = {"en", "hi", "mr", "te", "ta", "bn", "gu", "kn", "ml", "or", "pa"}
        if v not in allowed:
            raise ValueError(f"language must be one of {sorted(allowed)}")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    type: str = "Bearer"
    email: str
    fullName: str
    role: str
    language: str
    userId: str
