from enum import StrEnum

class AutomationRuleLastRunType0Status(StrEnum):
    ERROR = "error"
    LOOP = "loop"
    NO_MATCH = "no-match"
    SUCCESS = "success"
    THROTTLED = "throttled"

    def __str__(self) -> str:
        return str(self.value)
