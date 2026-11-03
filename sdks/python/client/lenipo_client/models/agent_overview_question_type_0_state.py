from enum import StrEnum

class AgentOverviewQuestionType0State(StrEnum):
    BLOCKED = "blocked"
    WAITING = "waiting"

    def __str__(self) -> str:
        return str(self.value)
