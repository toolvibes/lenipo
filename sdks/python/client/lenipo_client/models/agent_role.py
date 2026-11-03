from enum import StrEnum

class AgentRole(StrEnum):
    COORDINATOR = "coordinator"
    IMPLEMENTER = "implementer"
    PLANNER = "planner"
    REVIEWER = "reviewer"
    TESTER = "tester"

    def __str__(self) -> str:
        return str(self.value)
