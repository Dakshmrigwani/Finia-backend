"""AI Agent WebSocket routes with streaming support (LangChain + LangGraph)."""

import json
import logging
import time
from collections.abc import AsyncGenerator
from typing import Annotated, Any
from uuid import UUID

import logfire
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, SystemMessage
from pydantic import BaseModel


from app.agents.assistant import financial_agent
from app.agents.context import set_agent_context
from app.api.deps import DBSession, get_conversation_service, get_current_user, get_ws_current_user
from app.db.models.user import User
from app.db.session import get_db_context
from app.schemas.conversation import (
    ConversationCreate,
    MessageCreate,
)
from app.services.memory import MemoryService


logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    """Chat request schema."""

    message: str


def build_message_history(
    history: list[dict[str, str]],
) -> list[HumanMessage | AIMessage | SystemMessage]:
    """Convert conversation history to LangChain message format."""
    messages: list[HumanMessage | AIMessage | SystemMessage] = []
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))
        elif msg["role"] == "system":
            messages.append(SystemMessage(content=msg["content"]))
    return messages


def _extract_text(content: Any) -> str:
    """Safely extract text from an AIMessageChunk content field.

    LangChain content can be a plain string or a list of content blocks
    e.g. [{"type": "text", "text": "..."}].
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return ""


@router.post("/agent/chat")
@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DBSession,
) -> StreamingResponse:
    """Chat with Finia AI financial coach with SSE response streaming.

    Enriches context with long-term memory (pgvector recall + user facts)
    and stores each turn's embeddings for future recall.

    Streams response chunks using Server-Sent Events (SSE) format: 'data: {chunk}\\n\\n'.
    """
    user_id = str(current_user.id)
    memory_service = MemoryService(db)

    # ── Build memory-enriched context ─────────────────────────────────────────
    memories = await memory_service.recall_relevant(user_id, request.message, top_k=4)
    user_facts = await memory_service.get_user_facts(user_id)

    memory_context_parts = []
    if user_facts:
        facts_str = "\n".join(f"  - {k}: {v}" for k, v in user_facts.items())
        memory_context_parts.append(f"Known facts about this user:\n{facts_str}")
    if memories:
        memories_str = "\n".join(f"  - {m}" for m in memories)
        memory_context_parts.append(f"Relevant past conversations:\n{memories_str}")

    input_messages: dict
    if memory_context_parts:
        memory_injection = SystemMessage(
            content="[MEMORY CONTEXT]\n" + "\n\n".join(memory_context_parts)
        )
        input_messages = {"messages": [memory_injection, HumanMessage(content=request.message)]}
    else:
        input_messages = {"messages": [HumanMessage(content=request.message)]}

    set_agent_context(user_id, db)

    # ── Store user message embedding (fire-and-forget style) ──────────────────
    try:
        await memory_service.embed_and_store(user_id, "user", request.message)
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to store user message embedding: {e}")

    final_output: list[str] = []

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for event in financial_agent.astream_events(input_messages, version="v2"):
                kind = event["event"]
                if kind == "on_chat_model_stream":
                    chunk = event["data"].get("chunk")
                    if isinstance(chunk, AIMessageChunk):
                        text = _extract_text(chunk.content)
                        if text:
                            final_output.append(text)
                            yield f"data: {text}\n\n"
        except Exception as e:
            logger.exception(f"Error streaming response from financial_agent: {e}")
            yield f"data: [ERROR] {e!s}\n\n"

        # ── Post-response: store AI response embedding + extract user facts ───
        full_response = "".join(final_output)
        if full_response:
            try:
                await memory_service.embed_and_store(user_id, "assistant", full_response)
                await memory_service.extract_and_store_facts(user_id, request.message, full_response)
                await db.commit()
            except Exception as e:
                logger.warning(f"Failed to store assistant embedding / facts: {e}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── WebSocket connection manager ───────────────────────────────────────────────

class AgentConnectionManager:
    """WebSocket connection manager for AI agent."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Agent WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"Agent WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_event(self, websocket: WebSocket, event_type: str, data: Any) -> bool:
        """Send a JSON event to a specific WebSocket client.

        Returns True if sent successfully, False if connection is closed.
        """
        try:
            await websocket.send_json({"type": event_type, "data": data})
            return True
        except (WebSocketDisconnect, RuntimeError):
            return False


manager = AgentConnectionManager()

TOOL_LABELS: dict[str, str] = {
    "get_recent_transactions": "Checking your recent transactions...",
    "get_spending_summary": "Analyzing your spending summary...",
    "get_category_spending": "Calculating category expenses...",
    "get_user_profile": "Reviewing your financial profile...",
    "get_budgets": "Checking your budgets and spending limits...",
    "get_goals": "Reviewing your savings and financial goals...",
    "get_current_datetime": "Checking current date and time...",
    "recall_memory": "Searching long-term memory...",
}


@router.websocket("/ws/agent")
async def agent_websocket(
    websocket: WebSocket,
    current_user: Annotated[User, Depends(get_ws_current_user)],
) -> None:
    """WebSocket endpoint for AI agent with full event streaming and timing instrumentation.

    Authentication: pass the JWT access token as a query parameter:
    ``wss://host/api/v1/ws/agent?token=<access_token>``
    The connection is rejected with close code 4401 if the token is missing,
    invalid, expired, or belongs to an inactive user.

    Uses LangGraph astream_events (v2) to stream all agent events including:
    - user_prompt: When user input is received
    - model_request_start: When model request begins (on_chat_model_start)
    - text_delta: Streaming text from the model (on_chat_model_stream)
    - tool_call: When a tool is called (on_tool_start)
    - tool_result: When a tool returns a result (on_tool_end)
    - final_result: When the final result is ready (on_chain_end for agent)
    - complete: When processing is complete (with latency metrics)
    - error: When an error occurs

    Expected input message format:
    {
        "message": "user message here",
        "history": [{"role": "user|assistant|system", "content": "..."}],
        "conversation_id": "optional-uuid-to-continue-existing-conversation"
    }
    """
    await manager.connect(websocket)

    user_id = str(current_user.id)
    conversation_history: list[dict[str, str]] = []
    current_conversation_id: str | None = None

    try:
        while True:
            data = await websocket.receive_json()
            t_recv = time.perf_counter()
            user_message = data.get("message", "")
            if "history" in data:
                conversation_history = data["history"]

            if not user_message:
                await manager.send_event(websocket, "error", {"message": "Empty message"})
                continue

            try:
                async with get_db_context() as db:
                    conv_service = get_conversation_service(db)

                    # Handle conversation persistence
                    requested_conv_id = data.get("conversation_id")
                    if requested_conv_id:
                        current_conversation_id = requested_conv_id
                        await conv_service.get_conversation(UUID(requested_conv_id))
                    elif not current_conversation_id:
                        conv_data = ConversationCreate(
                            title=user_message[:50] if len(user_message) > 50 else user_message,
                        )
                        conversation = await conv_service.create_conversation(conv_data)
                        current_conversation_id = str(conversation.id)
                        await manager.send_event(
                            websocket,
                            "conversation_created",
                            {"conversation_id": current_conversation_id},
                        )

                    # Save user message
                    await conv_service.add_message(
                        UUID(current_conversation_id),
                        MessageCreate(role="user", content=user_message),
                    )

                    await manager.send_event(websocket, "user_prompt", {"content": user_message})

                    # ── Memory enrichment ──────────────────────────────────────
                    memory_service = MemoryService(db)
                    memories = await memory_service.recall_relevant(
                        user_id, user_message, top_k=4
                    )
                    user_facts = await memory_service.get_user_facts(user_id)
                    # Embed and store incoming user message
                    await memory_service.embed_and_store(user_id, "user", user_message)

                    # Set per-request context (user_id + db) for tool injection via ContextVar
                    set_agent_context(user_id, db)

                    # Build message history for LangGraph
                    lc_history = build_message_history(conversation_history)

                    # Prepend memory context as a SystemMessage if any facts/memories exist
                    memory_context_parts = []
                    if user_facts:
                        facts_str = "\n".join(f"  - {k}: {v}" for k, v in user_facts.items())
                        memory_context_parts.append(f"Known facts about this user:\n{facts_str}")
                    if memories:
                        memories_str = "\n".join(f"  - {m}" for m in memories)
                        memory_context_parts.append(f"Relevant past conversations:\n{memories_str}")

                    if memory_context_parts:
                        memory_msg = SystemMessage(
                            content="[MEMORY CONTEXT]\n" + "\n\n".join(memory_context_parts)
                        )
                        all_messages = [memory_msg] + lc_history + [HumanMessage(content=user_message)]
                    else:
                        all_messages = lc_history + [HumanMessage(content=user_message)]

                    # Timing trackers
                    t_model_start: float | None = None
                    tool_start_times: dict[str, tuple[str, float]] = {}
                    last_tool_result_time: float | None = None
                    t_first_text_delta: float | None = None
                    final_output: str = ""

                    # Stream events from LangGraph
                    async for event in financial_agent.astream_events(
                        {"messages": all_messages},

                        version="v2",
                    ):
                        kind = event["event"]
                        name = event.get("name", "")

                        # ── Model starts generating ────────────────────────────
                        if kind == "on_chat_model_start":
                            if t_model_start is None:
                                t_model_start = time.perf_counter()
                                dur_to_model = t_model_start - t_recv
                                logger.info(
                                    f"[TIMING 1] Message received -> model_request_start: "
                                    f"{dur_to_model:.3f}s ({dur_to_model * 1000:.1f}ms)"
                                )
                                logfire.info(
                                    "Agent model_request_start reached in {duration:.3f}s",
                                    duration=dur_to_model,
                                )
                            await manager.send_event(websocket, "model_request_start", {})

                        # ── Streaming text delta ───────────────────────────────
                        elif kind == "on_chat_model_stream":
                            chunk = event["data"].get("chunk")
                            if isinstance(chunk, AIMessageChunk):
                                text = _extract_text(chunk.content)
                                if text:
                                    if t_first_text_delta is None:
                                        t_first_text_delta = time.perf_counter()
                                        if last_tool_result_time is not None:
                                            dur_tool_to_text = t_first_text_delta - last_tool_result_time
                                            logger.info(
                                                f"[TIMING 3] Final tool_result -> first text_delta: "
                                                f"{dur_tool_to_text:.3f}s ({dur_tool_to_text * 1000:.1f}ms)"
                                            )
                                            logfire.info(
                                                "Agent tool_result to first text_delta: {duration:.3f}s",
                                                duration=dur_tool_to_text,
                                            )
                                    final_output += text
                                    await manager.send_event(
                                        websocket,
                                        "text_delta",
                                        {"content": text},
                                    )

                        # ── Tool call begins ───────────────────────────────────
                        elif kind == "on_tool_start":
                            t_call = time.perf_counter()
                            tool_name = name
                            tool_call_id = event.get("run_id", tool_name)
                            tool_start_times[tool_call_id] = (tool_name, t_call)
                            label = TOOL_LABELS.get(tool_name, f"Running {tool_name}...")
                            raw_input = event["data"].get("input", {})
                            args_str = (
                                json.dumps(raw_input)
                                if isinstance(raw_input, dict)
                                else str(raw_input)
                            )
                            logger.info(
                                f"[TOOL CALL] {tool_name} called at "
                                f"{t_call - t_recv:.3f}s from message receive"
                            )
                            await manager.send_event(
                                websocket,
                                "tool_call",
                                {
                                    "tool_name": tool_name,
                                    "label": label,
                                    "args": args_str,
                                    "tool_call_id": tool_call_id,
                                },
                            )

                        # ── Tool call returns ──────────────────────────────────
                        elif kind == "on_tool_end":
                            t_res = time.perf_counter()
                            last_tool_result_time = t_res
                            tool_call_id = event.get("run_id", name)
                            tool_info = tool_start_times.get(tool_call_id)
                            tool_dur = (t_res - tool_info[1]) if tool_info else None
                            tool_name = tool_info[0] if tool_info else name
                            if tool_dur is not None:
                                logger.info(
                                    f"[TIMING 2] Tool execution [{tool_name}]: "
                                    f"{tool_dur:.3f}s ({tool_dur * 1000:.1f}ms)"
                                )
                                logfire.info(
                                    "Tool {tool_name} executed in {duration:.3f}s",
                                    tool_name=tool_name,
                                    duration=tool_dur,
                                )
                            output = event["data"].get("output")
                            result_content = (
                                output.content
                                if hasattr(output, "content")
                                else str(output)
                            )
                            await manager.send_event(
                                websocket,
                                "tool_result",
                                {
                                    "tool_call_id": tool_call_id,
                                    "content": result_content,
                                    "duration_ms": (
                                        round(tool_dur * 1000, 2) if tool_dur is not None else None
                                    ),
                                },
                            )

                        # ── Agent chain ends (final answer ready) ─────────────
                        elif kind == "on_chain_end" and name == "LangGraph":
                            output_messages = (
                                event["data"].get("output", {}).get("messages", [])
                            )
                            if output_messages:
                                last_msg = output_messages[-1]
                                if hasattr(last_msg, "content") and last_msg.content:
                                    final_output = _extract_text(last_msg.content) or final_output
                            await manager.send_event(
                                websocket,
                                "final_result",
                                {"output": final_output},
                            )

                    # Update in-memory conversation history
                    conversation_history.append({"role": "user", "content": user_message})
                    if final_output:
                        conversation_history.append(
                            {"role": "assistant", "content": final_output}
                        )

                    # Persist assistant response
                    if current_conversation_id and final_output:
                        try:
                            await conv_service.add_message(
                                UUID(current_conversation_id),
                                MessageCreate(
                                    role="assistant",
                                    content=final_output,
                                    model_name="finia-agent",
                                ),
                            )
                        except Exception as e:
                            logger.warning(f"Failed to persist assistant response: {e}")

                    # ── Store memory: embed assistant response + extract user facts ──
                    if final_output:
                        try:
                            await memory_service.embed_and_store(
                                user_id, "assistant", final_output
                            )
                            await memory_service.extract_and_store_facts(
                                user_id, user_message, final_output
                            )
                        except Exception as e:
                            logger.warning(f"Failed to store memory after WS response: {e}")

                    total_dur = time.perf_counter() - t_recv
                    dur_tool_to_text = (
                        (t_first_text_delta - last_tool_result_time)
                        if (t_first_text_delta and last_tool_result_time)
                        else None
                    )
                    logger.info(
                        f"[TIMING SUMMARY] Request finished in {total_dur:.3f}s total "
                        f"(message->model: {((t_model_start - t_recv) * 1000) if t_model_start else 0:.1f}ms, "
                        f"tool->text: {((dur_tool_to_text * 1000) if dur_tool_to_text else 0):.1f}ms)"
                    )

                    await manager.send_event(
                        websocket,
                        "complete",
                        {
                            "conversation_id": current_conversation_id,
                            "timings": {
                                "message_to_model_ms": (
                                    round((t_model_start - t_recv) * 1000, 2) if t_model_start else None
                                ),
                                "final_tool_to_text_ms": (
                                    round(dur_tool_to_text * 1000, 2) if dur_tool_to_text else None
                                ),
                                "total_duration_ms": round(total_dur * 1000, 2),
                            },
                        },
                    )

            except WebSocketDisconnect:
                logger.info("Client disconnected during agent processing")
                break
            except Exception as e:
                logger.exception(f"Error processing agent request: {e}")
                await manager.send_event(websocket, "error", {"message": str(e)})

    except WebSocketDisconnect:
        pass  # Normal disconnect
    finally:
        manager.disconnect(websocket)
