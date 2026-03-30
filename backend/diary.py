"""
diary.py
========
AI reflection and diary system for capturing customer insights.
The agent writes structured diary entries about patron preferences, style, and interactions.
"""

import json
import logging
import os
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, List

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

DIARY_DIR = Path(os.getenv("DIARY_DIR", "./data/diary"))
DIARY_DIR.mkdir(parents=True, exist_ok=True)


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class StyleInsight:
    """A structured insight about the patron's style."""
    category: str  # "palette", "silhouette", "fabric", "occasion", "brand_affinity", "fit_preference"
    insight: str
    confidence: float  # 0.0-1.0, how certain we are
    evidence: List[str]  # Quotes or observations that support this
    created_at: float


@dataclass
class InteractionRecord:
    """Record of a single interaction with the patron."""
    timestamp: float
    type: str  # "chat", "image_upload", "search", "product_view", "cart_action"
    summary: str
    context: dict  # Additional context (products viewed, images uploaded, etc.)
    mood: Optional[str]  # "exploratory", "decisive", "uncertain", "browsing"


@dataclass
class DiaryEntry:
    """A structured diary entry about the patron."""
    patron_email: str
    entry_id: str
    timestamp: float
    type: str  # "style_discovery", "preference_update", "interaction_summary", "reflection"
    title: str
    content: str
    insights: List[StyleInsight]
    interactions: List[InteractionRecord]
    tags: List[str]
    follow_up_actions: List[str]  # Things to remember for next conversation


# ── Diary Store ──────────────────────────────────────────────────────────────

class DiaryStore:
    """
    File-based diary store for patron insights and reflections.
    Each patron has their own diary file.
    """

    def __init__(self, diary_dir: Path = DIARY_DIR):
        self.diary_dir = diary_dir
        self._cache: dict[str, DiaryEntry] = {}  # email -> merged entry

    def _get_diary_path(self, email: str) -> Path:
        """Get the diary file path for a patron."""
        safe_email = email.replace("@", "_at_").replace(".", "_")
        return self.diary_dir / f"{safe_email}.json"

    def _load_diary(self, email: str) -> Optional[DiaryEntry]:
        """Load diary for a patron."""
        if email in self._cache:
            return self._cache[email]

        diary_path = self._get_diary_path(email)
        if not diary_path.exists():
            return None

        try:
            with diary_path.open("r", encoding="utf-8") as f:
                data = json.load(f)

            # Reconstruct diary entry
            insights = [StyleInsight(**i) for i in data.get("insights", [])]
            interactions = [InteractionRecord(**i) for i in data.get("interactions", [])]

            diary = DiaryEntry(
                patron_email=email,
                entry_id=data.get("entry_id", "main"),
                timestamp=data.get("timestamp", datetime.now().timestamp()),
                type="cumulative",
                title=f"Style Diary for {email}",
                content=data.get("content", ""),
                insights=insights,
                interactions=interactions,
                tags=data.get("tags", []),
                follow_up_actions=data.get("follow_up_actions", []),
            )
            self._cache[email] = diary
            return diary
        except Exception as e:
            logger.warning(f"Failed to load diary for {email}: {e}")
            return None

    def _save_diary(self, email: str, diary: DiaryEntry) -> None:
        """Save diary for a patron."""
        diary_path = self._get_diary_path(email)

        try:
            with diary_path.open("w", encoding="utf-8") as f:
                json.dump(asdict(diary), f, indent=2, ensure_ascii=False)
            logger.info(f"Saved diary for {email} ({len(diary.insights)} insights)")
        except Exception as e:
            logger.error(f"Failed to save diary for {email}: {e}")

    def add_insight(
        self,
        email: str,
        category: str,
        insight: str,
        confidence: float,
        evidence: List[str],
    ) -> StyleInsight:
        """Add a style insight to the patron's diary."""
        diary = self._load_diary(email)
        if diary is None:
            # Create new diary
            diary = DiaryEntry(
                patron_email=email,
                entry_id=f"diary_{email}",
                timestamp=datetime.now().timestamp(),
                type="cumulative",
                title=f"Style Diary for {email}",
                content=f"Ongoing style journal for {email}",
                insights=[],
                interactions=[],
                tags=[],
                follow_up_actions=[],
            )

        # Check if similar insight exists
        existing = None
        for i in diary.insights:
            if i.category == category and i.insight.lower() == insight.lower():
                existing = i
                break

        if existing:
            # Update existing insight
            existing.confidence = max(existing.confidence, confidence)
            existing.evidence.extend(evidence)
            existing.evidence = list(set(existing.evidence))[:10]  # Keep last 10
        else:
            # Add new insight
            new_insight = StyleInsight(
                category=category,
                insight=insight,
                confidence=confidence,
                evidence=evidence,
                created_at=datetime.now().timestamp(),
            )
            diary.insights.append(new_insight)

        self._save_diary(email, diary)
        return diary.insights[-1] if not existing else existing

    def add_interaction(
        self,
        email: str,
        interaction_type: str,
        summary: str,
        context: dict = None,
        mood: str = None,
    ) -> InteractionRecord:
        """Record an interaction with the patron."""
        diary = self._load_diary(email)
        if diary is None:
            diary = DiaryEntry(
                patron_email=email,
                entry_id=f"diary_{email}",
                timestamp=datetime.now().timestamp(),
                type="cumulative",
                title=f"Style Diary for {email}",
                content=f"Ongoing style journal for {email}",
                insights=[],
                interactions=[],
                tags=[],
                follow_up_actions=[],
            )

        record = InteractionRecord(
            timestamp=datetime.now().timestamp(),
            type=interaction_type,
            summary=summary,
            context=context or {},
            mood=mood,
        )
        diary.interactions.append(record)

        # Keep last 100 interactions
        diary.interactions = diary.interactions[-100:]

        self._save_diary(email, diary)
        return record

    def add_follow_up(self, email: str, action: str) -> None:
        """Add a follow-up action to remember for next conversation."""
        diary = self._load_diary(email)
        if diary is None:
            diary = DiaryEntry(
                patron_email=email,
                entry_id=f"diary_{email}",
                timestamp=datetime.now().timestamp(),
                type="cumulative",
                title=f"Style Diary for {email}",
                content=f"Ongoing style journal for {email}",
                insights=[],
                interactions=[],
                tags=[],
                follow_up_actions=[],
            )

        if action not in diary.follow_up_actions:
            diary.follow_up_actions.append(action)

        self._save_diary(email, diary)

    def get_summary(self, email: str) -> dict:
        """Get a summary of the patron's diary for the agent."""
        diary = self._load_diary(email)
        if diary is None:
            return {"exists": False}

        # Group insights by category
        insights_by_category = {}
        for insight in diary.insights:
            cat = insight.category
            if cat not in insights_by_category:
                insights_by_category[cat] = []
            insights_by_category[cat].append({
                "insight": insight.insight,
                "confidence": insight.confidence,
            })

        # Get recent interactions
        recent = diary.interactions[-10:]

        return {
            "exists": True,
            "total_insights": len(diary.insights),
            "total_interactions": len(diary.interactions),
            "insights_by_category": insights_by_category,
            "recent_interactions": [
                {"type": i.type, "summary": i.summary, "mood": i.mood}
                for i in recent
            ],
            "follow_up_actions": diary.follow_up_actions,
            "tags": diary.tags,
        }

    def write_reflection(
        self,
        email: str,
        title: str,
        content: str,
        tags: List[str] = None,
    ) -> None:
        """Write a reflection entry to the diary."""
        diary = self._load_diary(email)
        if diary is None:
            diary = DiaryEntry(
                patron_email=email,
                entry_id=f"diary_{email}",
                timestamp=datetime.now().timestamp(),
                type="cumulative",
                title=f"Style Diary for {email}",
                content=f"Ongoing style journal for {email}",
                insights=[],
                interactions=[],
                tags=[],
                follow_up_actions=[],
            )

        # Append to content
        timestamp_str = datetime.fromtimestamp(datetime.now().timestamp()).strftime("%Y-%m-%d %H:%M")
        reflection = f"\n\n--- {timestamp_str} ---\n{title}\n{content}"
        diary.content += reflection

        # Add tags
        if tags:
            for tag in tags:
                if tag not in diary.tags:
                    diary.tags.append(tag)

        self._save_diary(email, diary)


# ── Global instance ───────────────────────────────────────────────────────────

_diary_store: Optional[DiaryStore] = None


def get_diary_store() -> DiaryStore:
    """Get the global diary store instance."""
    global _diary_store
    if _diary_store is None:
        _diary_store = DiaryStore()
    return _diary_store


def init_diary_store() -> DiaryStore:
    """Initialize the diary store (call once at startup)."""
    global _diary_store
    _diary_store = DiaryStore()
    logger.info(f"Diary store initialized at {_diary_store.diary_dir}")
    return _diary_store
