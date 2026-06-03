"""Pydantic data models for the ClariFi API."""
from __future__ import annotations

from pydantic import BaseModel, Field


class AuthRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    name: str | None = None


class ProfileInput(BaseModel):
    householdType: str = "2-person renter/owner transition"
    region: str = "West"
    market: str = "Sacramento"
    monthlyIncome: float = 9400
    monthlyDebt: float = 1250
    savings: float = 82000
    targetPrice: float = 560000
    goals: list[str] = Field(default_factory=lambda: [
        "Build emergency runway",
        "Reach 20% down payment",
        "Compare target counties",
    ])


class ScenarioInput(BaseModel):
    market: str = "Sacramento"
    income: float = 9400
    debt: float = 1250
    savings: float = 82000
    price: float = 560000
    expenses: dict[str, float] = Field(default_factory=lambda: {
        "food": 900,
        "transport": 525,
        "lifestyle": 850,
        "investing": 1100,
    })


class AgentExplainInput(BaseModel):
    question: str
    scenario: ScenarioInput | None = None


class RiskGridRequest(BaseModel):
    market: str = "Sacramento"
    income: float = 9400
    debt: float = 1250
    savings: float = 82000
    price: float = 560000
    expenses: dict[str, float] = Field(default_factory=lambda: {
        "food": 900,
        "transport": 525,
        "lifestyle": 850,
        "investing": 1100,
    })
