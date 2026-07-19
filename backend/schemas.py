from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class WorkspaceCreate(BaseModel):
    name: str = "Untitled workspace"


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    activity: str
    tech_stack: list[str]
    phase: str
    confidence: int
    default_model: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)


class ToolData(BaseModel):
    name: str
    description: str
    paid: bool
    category: str
    best_for: str | None = None
    pros: list[str] | None = None
    cons: list[str] | None = None


class ConsensusOption(BaseModel):
    model: str
    recommendation: str
    confidence: float


class ConsensusData(BaseModel):
    options: list[ConsensusOption]
    final_index: int
    summary: str


class GeneratedPromptData(BaseModel):
    title: str
    platform: str
    body: str


class MessageResponse(BaseModel):
    id: UUID
    author: str
    kind: str
    content: str
    tool: ToolData | None = None
    tools: list[ToolData] | None = None
    consensus: ConsensusData | None = None
    generated_prompt: GeneratedPromptData | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SendMessageResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse
    workspace: WorkspaceResponse


class ToolResponse(BaseModel):
    id: UUID
    name: str
    category: str
    description: str
    paid: bool
    url: str
    supported_prompt_platforms: list[str]

    model_config = {"from_attributes": True}


class GeneratePromptRequest(BaseModel):
    platform: str = "Cursor"
    workspace_id: UUID | None = None
    context: str | None = None


class PromptResponse(BaseModel):
    id: UUID
    title: str
    platform: str
    body: str
    workspace_id: UUID
    tool_id: UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreate(BaseModel):
    provider: str
    api_key: str


class ApiKeyProviderResponse(BaseModel):
    provider: str
    masked_key: str | None
    status: str


class ConsensusResult(BaseModel):
    model: str
    recommendation: str
    confidence: float


class ConsensusEngineResult(BaseModel):
    results: list[ConsensusResult]
    winner: ConsensusResult
    final_index: int
    summary: str


class OrchestratorResult(BaseModel):
    kind: str
    content: str
    tool_data: list[dict[str, Any]] | dict[str, Any] | None = None
    consensus_data: dict[str, Any] | None = None
    generated_prompt: GeneratedPromptData | None = None
    phase: str | None = None
    tech_stack: list[str] | None = None
    confidence_delta: int = 0