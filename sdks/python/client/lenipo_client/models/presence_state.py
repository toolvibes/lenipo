from enum import StrEnum

class PresenceState(StrEnum):
    ACTIVE = "active"
    BLOCKED = "blocked"
    OFFLINE = "offline"
    WAITING = "waiting"

    def __str__(self) -> str:
        return str(self.value)
