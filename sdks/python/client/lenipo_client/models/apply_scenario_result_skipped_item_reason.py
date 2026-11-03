from enum import StrEnum

class ApplyScenarioResultSkippedItemReason(StrEnum):
    CHANGED = "changed"
    FORBIDDEN = "forbidden"
    GONE = "gone"

    def __str__(self) -> str:
        return str(self.value)
