from enum import StrEnum

class SystemInfoMode(StrEnum):
    ALL = "all"
    API = "api"
    COLLAB = "collab"
    WORKER = "worker"

    def __str__(self) -> str:
        return str(self.value)
