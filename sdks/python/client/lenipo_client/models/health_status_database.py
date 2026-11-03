from enum import StrEnum

class HealthStatusDatabase(StrEnum):
    OK = "ok"
    UNREACHABLE = "unreachable"

    def __str__(self) -> str:
        return str(self.value)
