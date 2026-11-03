from enum import StrEnum

class EmailMode(StrEnum):
    DAILY = "daily"
    IMMEDIATE = "immediate"
    WEEKLY = "weekly"

    def __str__(self) -> str:
        return str(self.value)
